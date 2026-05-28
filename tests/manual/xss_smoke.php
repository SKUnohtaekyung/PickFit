<?php

declare(strict_types=1);

/**
 * Stored-XSS regression test for Task A · P0-1 (server side).
 *
 * Inserts a synthetic crawl payload with HTML/script tags through
 * ProductRepository::upsertFromCrawl and verifies the persisted row no
 * longer contains dangerous markup. Cleanup deletes the row at the end.
 *
 * No external API calls. Cost: $0. Requires MySQL running locally.
 *
 * Usage: php tests/manual/xss_smoke.php
 */

require __DIR__ . '/../../vendor/autoload.php';

use PickFit\Config;
use PickFit\Database;
use PickFit\Repositories\ProductRepository;

$config = Config::fromEnvironment(__DIR__ . '/../..');

try {
    $db = new Database($config);
    $pdo = $db->pdo();
} catch (Throwable $e) {
    echo 'ABORT: DB not reachable: ' . $e->getMessage() . PHP_EOL;
    exit(1);
}

$repo = new ProductRepository($pdo);

$payloadName = '<script>alert(1)</script><img src=x onerror=alert(2)>Slim Cotton Shirt';
$payloadBrand = "<b onclick='steal()'>EVIL\nBRAND</b>\u{200B}";
$payloadCategorySub = '<a href=javascript:alert(3)>슬랙스</a>';
$payloadMaterial = '<svg/onload=alert(4)>코튼';

$sourceUrl = 'https://xss-smoke.test.local/' . bin2hex(random_bytes(4));

$productId = $repo->upsertFromCrawl([
    'sourceUrl' => $sourceUrl,
    'sourceDomain' => 'xss-smoke.test.local',
    'productName' => $payloadName,
    'brandName' => $payloadBrand,
    'priceCandidates' => [50000],
    'currencyCandidates' => ['KRW'],
    'heroImageUrl' => 'https://xss-smoke.test.local/image.jpg',
    'imageUrls' => [],
]);

echo 'Created product id: ' . $productId . PHP_EOL;

// Now exercise applyOpenAiExtraction with a malicious enum-tainted payload.
// The validator should have caught most of this, but the repository must
// independently strip-tags as defense-in-depth.
$repo->applyOpenAiExtraction($productId, [
    'productName' => 'ignored — not updated by this method',
    'brandName' => 'ignored',
    'categoryMain' => 'top',
    'categorySub' => $payloadCategorySub,
    'priceSale' => null,
    'currency' => 'KRW',
    'fitType' => 'regular',
    'materialMain' => $payloadMaterial,
    'materialSub' => '<style>body{display:none}</style>',
    'thickness' => 'medium',
    'opacity' => 'opaque',
    'stretch' => 'low',
    'colorFamily' => '<i>네이비</i>',
    'seasonality' => ['fall', 'winter'],
    'styleTags' => ['오피스'],
    'occasionTags' => ['출근'],
    'shippingSummary' => null,
    'returnSummary' => null,
    'reviewSummary' => null,
    'riskFlags' => [],
    'confidence' => 0.9,
    'missingFields' => [],
    'warnings' => [],
]);

$stmt = $pdo->prepare(
    'SELECT product_name, brand_name, category_sub, material_main, material_sub, color_family
     FROM products WHERE id = :id LIMIT 1'
);
$stmt->execute(['id' => $productId]);
$row = $stmt->fetch();

$pass = 0;
$fail = 0;
$lines = [];

$check = function (string $label, bool $ok, string $observed) use (&$pass, &$fail, &$lines): void {
    if ($ok) {
        $pass++;
        $lines[] = sprintf("PASS  %-58s observed='%s'", $label, $observed);
    } else {
        $fail++;
        $lines[] = sprintf("FAIL  %-58s observed='%s'", $label, $observed);
    }
};

$forbidden = ['<script', '<img', '<svg', '<style', '<a ', '<b ', '<i>', 'onerror', 'onload', 'onclick', 'javascript:'];

foreach ([
    'product_name'  => 'productName',
    'brand_name'    => 'brandName',
    'category_sub'  => 'categorySub',
    'material_main' => 'materialMain',
    'material_sub'  => 'materialSub',
    'color_family'  => 'colorFamily',
] as $column => $label) {
    $value = (string) ($row[$column] ?? '');
    $contains = null;
    foreach ($forbidden as $needle) {
        if (stripos($value, $needle) !== false) {
            $contains = $needle;
            break;
        }
    }
    $check("$label has no HTML/JS markup", $contains === null, $value);
}

// Verify benign text was preserved across strip_tags
$check(
    'productName preserved "Slim Cotton Shirt"',
    str_contains((string) ($row['product_name'] ?? ''), 'Slim Cotton Shirt'),
    (string) ($row['product_name'] ?? '')
);
$check(
    'brandName preserved "BRAND" text',
    str_contains((string) ($row['brand_name'] ?? ''), 'BRAND'),
    (string) ($row['brand_name'] ?? '')
);

foreach ($lines as $line) {
    echo $line . PHP_EOL;
}
echo str_repeat('-', 60) . PHP_EOL;
echo sprintf('TOTAL: %d pass, %d fail%s', $pass, $fail, PHP_EOL);

// Cleanup
$pdo->exec('DELETE FROM product_media WHERE product_id = ' . $productId);
$pdo->exec('DELETE FROM products WHERE id = ' . $productId);
echo 'Cleanup: product id=' . $productId . ' + media rows deleted.' . PHP_EOL;

exit($fail === 0 ? 0 : 1);
