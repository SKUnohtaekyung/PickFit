<?php

declare(strict_types=1);

// PickFit Musinsa JSONL → DB import.
// Consumes the JSONL produced by `crawler/musinsa-batch.js` and upserts each
// row into products via ProductRepository, then applies a single follow-up
// UPDATE with fields the PLP API exposes directly (category_main from the
// JSONL `slot`, gender_target, stock_status, price_original, discount_rate).
//
// Operator-scoped: originType='batch', ownerUserId=NULL, crawlJobId=NULL.
//
// Usage:
//   php tests/manual/musinsa_import.php --in storage/seeds/musinsa-batch.jsonl
//   php tests/manual/musinsa_import.php --in ... --apply-openai
//
// Exit code 0 on success, 1 on argument/file error, 2 on partial failure
// (some rows skipped; details printed to stderr).

require __DIR__ . '/../../vendor/autoload.php';

use PickFit\Config;
use PickFit\Database;
use PickFit\Repositories\ProductRepository;
use PickFit\Services\OpenAIService;
use PickFit\Support\ResponseValidator;

function args(array $argv): array
{
    $out = [];
    $n = count($argv);
    for ($i = 1; $i < $n; $i++) {
        $tok = $argv[$i];
        if (str_starts_with($tok, '--')) {
            $key = substr($tok, 2);
            $next = $argv[$i + 1] ?? null;
            if ($next !== null && !str_starts_with($next, '--')) {
                $out[$key] = $next;
                $i++;
            } else {
                $out[$key] = true;
            }
        }
    }
    return $out;
}

function mapGender(?string $displayGenderText): ?string
{
    return match ($displayGenderText) {
        '남성' => 'male',
        '여성' => 'female',
        '공용' => 'unisex',
        default => null,
    };
}

$opts = args($argv);
$inPath = $opts['in'] ?? null;
if (!is_string($inPath) || !is_file($inPath)) {
    fwrite(STDERR, "Missing or invalid --in <path-to-jsonl>\n");
    exit(1);
}
$applyOpenAi = isset($opts['apply-openai']);

$projectRoot = dirname(__DIR__, 2);
$config = Config::fromEnvironment($projectRoot);
$pdo = (new Database($config))->pdo();
$repo = new ProductRepository($pdo);

$openAi = null;
$validator = null;
$extractionSchemaJson = '';
if ($applyOpenAi) {
    // OPENAI_EXTRACTION_ENABLED is a runtime circuit breaker for the user-facing
    // crawler service. This batch importer is operator-explicit (--apply-openai),
    // so we only require the API key.
    if (!$config->openAiApiKey()) {
        fwrite(STDERR, "--apply-openai requested but OPENAI_API_KEY missing in .env\n");
        exit(1);
    }
    $openAi = new OpenAIService(
        $config,
        $projectRoot . '/src/Support/prompts',
        $projectRoot . '/storage/logs/openai',
        $projectRoot . '/storage/certs/cacert.pem',
    );
    $validator = new ResponseValidator();
    $schemaPath = $projectRoot . '/src/Support/schemas/product_extraction.schema.json';
    $extractionSchemaJson = is_file($schemaPath) ? (string) file_get_contents($schemaPath) : '';
    if ($extractionSchemaJson === '') {
        fwrite(STDERR, "extraction schema missing at {$schemaPath}\n");
        exit(1);
    }
}

$handle = fopen($inPath, 'rb');
if (!$handle) {
    fwrite(STDERR, "Cannot open {$inPath}\n");
    exit(1);
}

$inserted = 0;
$updated = 0;
$openAiApplied = 0;
$openAiFailed = 0;
$skipped = 0;
$lineNo = 0;
$errors = [];

$updateStmt = $pdo->prepare(
    'UPDATE products
     SET category_main = :categoryMain,
         gender_target = :genderTarget,
         stock_status = :stockStatus,
         price_original = COALESCE(:priceOriginal, price_original),
         discount_rate = :discountRate
     WHERE id = :id'
);

$preCount = (int) $pdo->query("SELECT COUNT(*) FROM products WHERE source_domain = 'www.musinsa.com'")
    ->fetchColumn();

while (($line = fgets($handle)) !== false) {
    $lineNo++;
    $line = trim($line);
    if ($line === '') continue;

    try {
        $row = json_decode($line, true, 32, JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        $errors[] = "line {$lineNo}: invalid JSON";
        $skipped++;
        continue;
    }

    $slot = $row['slot'] ?? null;
    $goodsLinkUrl = $row['goodsLinkUrl'] ?? null;
    if (!in_array($slot, ['top', 'bottom', 'outer', 'shoes'], true)
        || !is_string($goodsLinkUrl)
        || $goodsLinkUrl === ''
    ) {
        $errors[] = "line {$lineNo}: missing slot or goodsLinkUrl";
        $skipped++;
        continue;
    }

    $checkStmt = $pdo->prepare('SELECT id FROM products WHERE source_url = :u LIMIT 1');
    $checkStmt->execute(['u' => $goodsLinkUrl]);
    $existedId = $checkStmt->fetchColumn();

    $finalPrice = is_int($row['finalPrice'] ?? null) ? $row['finalPrice'] : null;
    $normalPrice = is_int($row['normalPrice'] ?? null) ? $row['normalPrice'] : null;
    $discount = is_int($row['finalDiscount'] ?? null) ? $row['finalDiscount'] : null;

    $payload = [
        'sourceUrl' => $goodsLinkUrl,
        'sourceDomain' => 'www.musinsa.com',
        'originType' => 'batch',
        'ownerUserId' => null,
        'crawlJobId' => null,
        'productName' => $row['goodsName'] ?? null,
        'brandName' => $row['brandName'] ?? null,
        'description' => null,
        'priceCandidates' => $finalPrice !== null ? [$finalPrice] : [],
        'currencyCandidates' => ['KRW'],
        'heroImageUrl' => $row['thumbnail'] ?? null,
        'imageUrls' => array_values(array_filter([$row['thumbnail'] ?? null])),
        'rawTextPreview' => null,
        'screenshotPath' => null,
    ];

    try {
        $productId = $repo->upsertFromCrawl($payload);
    } catch (Throwable $e) {
        $errors[] = "line {$lineNo}: upsert failed: " . $e->getMessage();
        $skipped++;
        continue;
    }

    $isSoldOut = !empty($row['isSoldOut']);
    try {
        $updateStmt->execute([
            'categoryMain' => $slot,
            'genderTarget' => mapGender($row['displayGenderText'] ?? null),
            'stockStatus' => $isSoldOut ? 'sold_out' : 'in_stock',
            'priceOriginal' => $normalPrice,
            'discountRate' => $discount !== null ? round($discount, 2) : null,
            'id' => $productId,
        ]);
    } catch (Throwable $e) {
        $errors[] = "line {$lineNo}: post-update failed: " . $e->getMessage();
    }

    if ($existedId === false) {
        $inserted++;
    } else {
        $updated++;
    }

    if ($applyOpenAi && $openAi !== null && $validator !== null) {
        $extractionPayload = [
            'finalUrl' => $goodsLinkUrl,
            'productName' => $row['goodsName'] ?? null,
            'brandName' => $row['brandName'] ?? null,
            'description' => null,
            'priceCandidates' => $finalPrice !== null ? [$finalPrice] : [],
            'currencyCandidates' => ['KRW'],
            'imageUrls' => array_values(array_filter([$row['thumbnail'] ?? null])),
            'text' => null,
            'meta' => [],
            // PLP-only hint to the model: the operator-assigned slot.
            'slotHint' => $slot,
        ];
        $apiResult = $openAi->extractProductFields($extractionPayload, $extractionSchemaJson);
        if (($apiResult['ok'] ?? false) === true && is_array($apiResult['data'] ?? null)) {
            $validation = $validator->validateProductExtraction($apiResult['data']);
            if (($validation['ok'] ?? false) === true && is_array($validation['normalizedPayload'] ?? null)) {
                try {
                    $repo->applyOpenAiExtraction($productId, $validation['normalizedPayload']);
                    // Slot is operator-assigned from PLP category — re-assert it after
                    // OpenAI extraction in case the model returned a different categoryMain.
                    $pdo->prepare('UPDATE products SET category_main = :slot WHERE id = :id')
                        ->execute(['slot' => $slot, 'id' => $productId]);
                    $openAiApplied++;
                } catch (Throwable $e) {
                    $openAiFailed++;
                    $errors[] = "line {$lineNo}: applyOpenAiExtraction failed: " . $e->getMessage();
                }
            } else {
                $openAiFailed++;
            }
        } else {
            $openAiFailed++;
        }
    }
}

fclose($handle);

$postCount = (int) $pdo->query("SELECT COUNT(*) FROM products WHERE source_domain = 'www.musinsa.com'")
    ->fetchColumn();

$summary = [
    'inserted' => $inserted,
    'updated' => $updated,
    'skipped' => $skipped,
    'openAiApplied' => $openAiApplied,
    'openAiFailed' => $openAiFailed,
    'preBatchCount' => $preCount,
    'postBatchCount' => $postCount,
    'errors' => array_slice($errors, 0, 20),
];

echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";

exit($skipped > 0 || $openAiFailed > 0 ? 2 : 0);
