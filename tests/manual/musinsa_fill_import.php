<?php

declare(strict_types=1);

// PickFit — write fashion-expert-normalized catalog data into the DB (Phase 3).
// Consumes storage/seeds/musinsa-normalized.jsonl (produced by
// crawler/musinsa-normalize.js) and, per product (matched by source_url):
//   1) applyOpenAiExtraction() → fit_type, material_main, thickness, opacity,
//      stretch, seasonality, color_family, style_tags, occasion_tags, ...
//   2) replaces synthetic review rows so review_rating/count reflect Musinsa's
//      real reviewScore/reviewCount (no fabricated review TEXT — left null).
// Idempotent: re-running updates products and rebuilds the review rows.
//
// Usage: php tests/manual/musinsa_fill_import.php --in storage/seeds/musinsa-normalized.jsonl

require __DIR__ . '/../../vendor/autoload.php';

use PickFit\Config;
use PickFit\Database;
use PickFit\Repositories\ProductRepository;
use PickFit\Support\PublicId;

const REVIEW_ROW_CAP = 30; // bound synthetic rows; still reflects the real count up to this

function args(array $argv): array
{
    $out = [];
    for ($i = 1, $n = count($argv); $i < $n; $i++) {
        if (!str_starts_with($argv[$i], '--')) continue;
        $key = substr($argv[$i], 2);
        $next = $argv[$i + 1] ?? null;
        if ($next !== null && !str_starts_with($next, '--')) { $out[$key] = $next; $i++; }
        else { $out[$key] = true; }
    }
    return $out;
}

$opts = args($argv);
$inPath = is_string($opts['in'] ?? null) ? $opts['in'] : 'storage/seeds/musinsa-normalized.jsonl';
if (!is_file($inPath)) {
    fwrite(STDERR, "missing --in file: {$inPath}\n");
    exit(1);
}

$projectRoot = dirname(__DIR__, 2);
$config = Config::fromEnvironment($projectRoot);
$pdo = (new Database($config))->pdo();
$repo = new ProductRepository($pdo);

$findStmt = $pdo->prepare('SELECT id FROM products WHERE source_url = :u LIMIT 1');
$delReviews = $pdo->prepare('DELETE FROM reviews WHERE product_id = :pid');
$insReview = $pdo->prepare(
    'INSERT INTO reviews (product_id, public_id, rating, review_text, size_runs, created_at)
     VALUES (:pid, :publicId, :rating, NULL, :sizeRuns, NOW())'
);

$updated = 0; $missing = 0; $reviewsInserted = 0; $skipped = 0;
$errors = [];

$fh = fopen($inPath, 'rb');
$lineNo = 0;
while (($line = fgets($fh)) !== false) {
    $lineNo++;
    $line = trim($line);
    if ($line === '') continue;
    try {
        $rec = json_decode($line, true, 32, JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        $errors[] = "line {$lineNo}: bad json"; $skipped++; continue;
    }

    $sourceUrl = $rec['sourceUrl'] ?? null;
    if (!is_string($sourceUrl) || $sourceUrl === '') { $skipped++; continue; }

    $findStmt->execute(['u' => $sourceUrl]);
    $productId = $findStmt->fetchColumn();
    if ($productId === false) { $missing++; continue; }
    $productId = (int) $productId;

    // Seasonality: store the joined token string (e.g. "spring/summer") so the
    // single VARCHAR column carries the full range — the UI seasonLabel splits on "/".
    $season = is_array($rec['seasonality'] ?? null) ? array_values(array_filter($rec['seasonality'], 'is_string')) : [];
    $seasonJoined = $season === [] ? [] : [implode('/', $season)];

    $payload = [
        'fitType' => $rec['fitType'] ?? null,
        'materialMain' => $rec['materialMain'] ?? null,
        'materialSub' => $rec['materialSub'] ?? null,
        'thickness' => $rec['thickness'] ?? null,
        'opacity' => $rec['opacity'] ?? null,
        'stretch' => $rec['stretch'] ?? null,
        'colorFamily' => $rec['colorFamily'] ?? null,
        'seasonality' => $seasonJoined,
        'styleTags' => is_array($rec['styleTags'] ?? null) ? $rec['styleTags'] : [],
        'occasionTags' => is_array($rec['occasionTags'] ?? null) ? $rec['occasionTags'] : [],
        'confidence' => is_numeric($rec['confidence'] ?? null) ? (float) $rec['confidence'] : null,
    ];

    try {
        $repo->applyOpenAiExtraction($productId, $payload);
        $updated++;
    } catch (Throwable $e) {
        $errors[] = "line {$lineNo}: applyOpenAiExtraction: " . $e->getMessage();
        continue;
    }

    // Reviews: rebuild synthetic rows reflecting Musinsa's real rating + count.
    $rating = $rec['rating'] ?? null;
    $count = (int) ($rec['reviewCount'] ?? 0);
    $delReviews->execute(['pid' => $productId]);
    if (is_numeric($rating) && $count > 0) {
        $rows = min($count, REVIEW_ROW_CAP);
        for ($r = 0; $r < $rows; $r++) {
            $insReview->execute([
                'pid' => $productId,
                'publicId' => PublicId::generate(),
                'rating' => round((float) $rating, 2),
                'sizeRuns' => 'unknown',
            ]);
            $reviewsInserted++;
        }
    }
}
fclose($fh);

echo json_encode([
    'productsUpdated' => $updated,
    'productsMissing' => $missing,
    'reviewsInserted' => $reviewsInserted,
    'skipped' => $skipped,
    'errors' => array_slice($errors, 0, 15),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";

exit($missing > 0 || $errors !== [] ? 2 : 0);
