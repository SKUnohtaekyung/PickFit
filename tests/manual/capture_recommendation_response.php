<?php

declare(strict_types=1);

/**
 * One-shot live capture: register a throwaway user, POST /api/recommendations,
 * dump the full API response (adapter input) to stdout AND to a file so we can
 * inspect product field shape. Cleanup deletes the test user at the end.
 *
 * Usage: php tests/manual/capture_recommendation_response.php
 */

require __DIR__ . '/../../vendor/autoload.php';

use PickFit\Config;
use PickFit\Database;
use PickFit\Repositories\ProductRepository;
use PickFit\Repositories\RecommendationRepository;
use PickFit\Repositories\UserRepository;
use PickFit\Services\OpenAIService;
use PickFit\Services\RecommendationService;
use PickFit\Support\ResponseValidator;

$projectRoot = realpath(__DIR__ . '/../..');
$config = Config::fromEnvironment($projectRoot);

try {
    $pdo = (new Database($config))->pdo();
} catch (Throwable $e) {
    echo "ABORT: DB not reachable: " . $e->getMessage() . PHP_EOL;
    exit(1);
}

$users = new UserRepository($pdo);
$email = 'diag-' . bin2hex(random_bytes(4)) . '@test.local';
$user = $users->create($email, password_hash('temp', PASSWORD_DEFAULT), 'Diag');
$userId = (int) $user['id'];

$caCertPath = $projectRoot . '/storage/certs/cacert.pem';
$openAi = new OpenAIService(
    $config,
    $projectRoot . '/src/Support/prompts',
    null,
    is_file($caCertPath) ? $caCertPath : null,
);

$schemaPath = $projectRoot . '/src/Support/schemas/recommendation.schema.json';
$schemaJson = is_file($schemaPath) ? (file_get_contents($schemaPath) ?: '') : '';

$service = new RecommendationService(
    new ProductRepository($pdo),
    new RecommendationRepository($pdo),
    $openAi,
    new ResponseValidator(),
    $schemaJson,
);

$conditions = [
    'situation' => 'rainy',          // matches what user screenshot title hinted at
    'budget' => '50k-100k',
    'mood' => ['casual'],
    'fit' => 'regular',
    'bodyType' => [],
    'colors' => [],
    'avoidances' => [],
    'freeText' => null,
];

try {
    $result = $service->generate($userId, $conditions, []);
} catch (Throwable $e) {
    echo "FAIL: " . $e->getMessage() . PHP_EOL;
    $pdo->exec('DELETE FROM users WHERE id = ' . $userId);
    exit(1);
}

$outFile = $projectRoot . '/storage/logs/recommendation_response.json';
@mkdir(dirname($outFile), 0775, true);
file_put_contents(
    $outFile,
    json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
);

echo "Source: " . $result['source'] . PHP_EOL;
echo "RunId : " . $result['runId'] . PHP_EOL;
echo "Outfits count: " . count($result['outfits']) . PHP_EOL;
echo PHP_EOL . "=== First outfit summary ===" . PHP_EOL;
$first = $result['outfits'][0] ?? null;
if ($first) {
    echo "title         : " . ($first['title'] ?? '(null)') . PHP_EOL;
    echo "framingLabel  : " . ($first['framingLabel'] ?? '(null)') . PHP_EOL;
    echo "totalPrice    : " . ($first['totalPrice'] ?? '(null)') . PHP_EOL;
    echo "items count   : " . count($first['items'] ?? []) . PHP_EOL;
    echo PHP_EOL . "=== First item ===" . PHP_EOL;
    $item = $first['items'][0] ?? null;
    if ($item) {
        echo "slot          : " . ($item['slot'] ?? '(null)') . PHP_EOL;
        echo "productPubId  : " . ($item['productPublicId'] ?? '(null)') . PHP_EOL;
        $p = $item['product'] ?? null;
        if ($p) {
            echo PHP_EOL . "  product keys = " . implode(', ', array_keys($p)) . PHP_EOL;
            echo "  brandName     : " . ($p['brandName'] ?? '(null)') . PHP_EOL;
            echo "  productName   : " . ($p['productName'] ?? '(null)') . PHP_EOL;
            echo "  priceSale     : " . ($p['priceSale'] ?? '(null)') . PHP_EOL;
            echo "  priceOriginal : " . ($p['priceOriginal'] ?? '(null)') . PHP_EOL;
            echo "  discountRate  : " . ($p['discountRate'] ?? '(null)') . PHP_EOL;
            echo "  heroImageUrl  : " . ($p['heroImageUrl'] ?? '(null)') . PHP_EOL;
            echo "  fitType       : " . ($p['fitType'] ?? '(null)') . PHP_EOL;
            echo "  seasonality   : " . ($p['seasonality'] ?? '(null)') . PHP_EOL;
            echo "  reviewRating  : " . ($p['reviewRating'] ?? '(null)') . PHP_EOL;
            echo "  reviewHighlight: " . ($p['reviewHighlight'] ?? '(null)') . PHP_EOL;
        } else {
            echo "  product       : (null) — this is the bug" . PHP_EOL;
        }
    }
}

echo PHP_EOL . "Full response saved to: " . $outFile . PHP_EOL;
$pdo->exec('DELETE FROM users WHERE id = ' . $userId);
echo "Cleanup: test user $userId deleted." . PHP_EOL;
