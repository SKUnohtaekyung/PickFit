<?php

declare(strict_types=1);

/**
 * Live wire-through check for sourceProductIds.
 *
 *   1. Pick two seed product publicIds (one top, one bottom).
 *   2. Call RecommendationService::generate() with those publicIds as
 *      sourceProductIds — backend's ProductRepository::scoreCandidate gives +5.
 *   3. Verify the response outfits actually include those publicIds (the
 *      frontend's countSourceMatches will compute selected > 0 in the same
 *      way once the recs hit the screen).
 *
 * Backend variance: OpenAI may rank differently; fallback engine is more
 * deterministic. Either way, +5 puts the source candidate at the top of its
 * slot, so it should appear in at least one outfit.
 *
 * Usage: php tests/manual/source_products_live.php
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

$pickTop = $pdo->query(
    "SELECT public_id FROM products
     WHERE origin_type = 'seed' AND category_main = 'top' LIMIT 1"
)->fetchColumn();
$pickBottom = $pdo->query(
    "SELECT public_id FROM products
     WHERE origin_type = 'seed' AND category_main = 'bottom' LIMIT 1"
)->fetchColumn();

if (!is_string($pickTop) || !is_string($pickBottom)) {
    echo "ABORT: missing seed top/bottom (got top={$pickTop}, bottom={$pickBottom})" . PHP_EOL;
    exit(1);
}

$sources = [$pickTop, $pickBottom];
echo "Source ids picked: " . implode(', ', $sources) . PHP_EOL;

$users = new UserRepository($pdo);
$email = 'source-live-' . bin2hex(random_bytes(4)) . '@test.local';
$user = $users->create($email, password_hash('temp', PASSWORD_DEFAULT), 'Source');
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
    'situation' => 'daily',
    'budget' => '50k-100k',
    'mood' => ['casual'],
    'fit' => 'regular',
    'bodyType' => [],
    'colors' => [],
    'avoidances' => [],
    'freeText' => null,
];

try {
    $result = $service->generate($userId, $conditions, $sources);
} catch (Throwable $e) {
    echo "FAIL: " . $e->getMessage() . PHP_EOL;
    $pdo->exec('DELETE FROM users WHERE id = ' . $userId);
    exit(1);
}

echo "Source mode  : " . $result['source'] . PHP_EOL;
echo "Run id       : " . $result['runId'] . PHP_EOL;
echo "Outfits      : " . count($result['outfits']) . PHP_EOL;

$primaryHits = [];
$alternativeHits = [];
$sourceSet = array_flip($sources);
foreach ($result['outfits'] as $outfit) {
    foreach (($outfit['items'] ?? []) as $item) {
        $primary = $item['productPublicId'] ?? null;
        if (is_string($primary) && isset($sourceSet[$primary])) {
            $primaryHits[$primary] = true;
        }
        foreach (($item['alternativeProductIds'] ?? []) as $altId) {
            if (is_string($altId) && isset($sourceSet[$altId])) {
                $alternativeHits[$altId] = true;
            }
        }
    }
}
foreach (array_keys($primaryHits) as $id) {
    unset($alternativeHits[$id]);
}

$selectedCount = count($primaryHits);
$alternativeCount = count($alternativeHits);
$status = $selectedCount > 0 ? 'PASS' : 'WARN';

echo PHP_EOL;
echo "selected     : {$selectedCount} / " . count($sources)
    . ' [' . implode(',', array_keys($primaryHits)) . ']' . PHP_EOL;
echo "alternatives : {$alternativeCount} [" . implode(',', array_keys($alternativeHits)) . "]" . PHP_EOL;
echo "Result       : {$status} — backend wire-through "
    . ($selectedCount > 0 ? 'verified' : 'did NOT surface source in primary items') . PHP_EOL;

$pdo->exec('DELETE FROM users WHERE id = ' . $userId);
echo "Cleanup      : user {$userId} deleted." . PHP_EOL;

exit($selectedCount > 0 ? 0 : 2);
