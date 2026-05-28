<?php

declare(strict_types=1);

/**
 * Single-shot live OpenAI integration smoke.
 *
 * Bypasses HTTP/session/CSRF and exercises RecommendationService::generate()
 * directly with a synthetic onboarding payload. Creates a throwaway test user,
 * lets the service write recommendation_runs + outfits + items via the real DB,
 * then deletes the user (cascade drops the run rows).
 *
 * Cost expectation: well under $0.01 for gpt-4o-mini.
 * No retries on failure. API key is never printed.
 *
 * Usage: php tests/manual/openai_live_smoke.php
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

if (!$config->openAiApiKey() || !$config->openAiModel()) {
    echo "ABORT: OPENAI_API_KEY or OPENAI_MODEL missing.\n";
    exit(1);
}

echo 'Model         : ' . $config->openAiModel() . PHP_EOL;
echo 'Timeout (s)   : ' . $config->openAiTimeoutSeconds() . PHP_EOL;

try {
    $db = new Database($config);
    $pdo = $db->pdo();
} catch (Throwable $e) {
    echo 'ABORT: DB connect failed: ' . $e->getMessage() . PHP_EOL;
    exit(1);
}

$users = new UserRepository($pdo);
$email = 'live-smoke-' . bin2hex(random_bytes(4)) . '@test.local';

try {
    $user = $users->create($email, password_hash('temp-pw', PASSWORD_DEFAULT), 'Live Smoke');
} catch (Throwable $e) {
    echo 'ABORT: failed to create test user: ' . $e->getMessage() . PHP_EOL;
    exit(1);
}

$userId = (int) $user['id'];
echo 'Test user id  : ' . $userId . PHP_EOL;
echo 'Test email    : ' . $email . PHP_EOL;

$schemaPath = $projectRoot . '/src/Support/schemas/recommendation.schema.json';
$schemaJson = is_file($schemaPath) ? (file_get_contents($schemaPath) ?: '') : '';
if ($schemaJson === '') {
    echo 'ABORT: recommendation schema not loadable.' . PHP_EOL;
    $pdo->exec('DELETE FROM users WHERE id = ' . $userId);
    exit(1);
}

$caCertPath = $projectRoot . '/storage/certs/cacert.pem';
$logDir = $projectRoot . '/storage/logs/openai';   // enable file logger so raw responses are inspectable
$openAi = new OpenAIService(
    $config,
    $projectRoot . '/src/Support/prompts',
    $logDir,
    is_file($caCertPath) ? $caCertPath : null,
);
$validator = new ResponseValidator();

echo 'CA bundle     : ' . (is_file($caCertPath) ? $caCertPath : '(none — system default)') . PHP_EOL;
echo 'Log directory : ' . $logDir . PHP_EOL;

// Pipeline probe: real candidates + real schema + real validator. Mirrors what
// RecommendationService::generate() does, but prints each step so failure mode
// (HTTP / validation / conversion) is visible.
$schemaPath = $projectRoot . '/src/Support/schemas/recommendation.schema.json';
$schemaJsonProbe = is_file($schemaPath) ? (file_get_contents($schemaPath) ?: '') : '';

$productsRepo = new ProductRepository($pdo);
$probeConditions = [
    'situation' => 'office',
    'budget' => '50k-100k',
    'mood' => ['clean', 'minimal'],
    'fit' => 'regular',
    'bodyType' => [],
    'colors' => [],
    'avoidances' => [],
    'freeText' => null,
];
$realCandidates = $productsRepo->findRecommendationCandidates($probeConditions, []);
$candidateIds = [];
foreach ($realCandidates as $slot => $list) {
    foreach ($list as $product) {
        if (isset($product['publicId']) && is_string($product['publicId'])) {
            $candidateIds[] = $product['publicId'];
        }
    }
}
echo 'Real candidates: top=' . count($realCandidates['top'] ?? [])
    . ' bottom=' . count($realCandidates['bottom'] ?? [])
    . ' shoes=' . count($realCandidates['shoes'] ?? [])
    . ' outer=' . count($realCandidates['outer'] ?? [])
    . ' (total candidateIds=' . count($candidateIds) . ')' . PHP_EOL;

// Compact candidate summary for the model (matches summarizeCandidatesForPrompt)
$compactCandidates = ['top' => [], 'bottom' => [], 'shoes' => [], 'outer' => []];
foreach ($realCandidates as $slot => $list) {
    if (!isset($compactCandidates[$slot])) {
        continue;
    }
    foreach ($list as $p) {
        $compactCandidates[$slot][] = [
            'publicId' => (string) ($p['publicId'] ?? ''),
            'brandName' => $p['brandName'] ?? null,
            'productName' => $p['productName'] ?? null,
            'priceSale' => $p['priceSale'] ?? null,
            'fitType' => $p['fitType'] ?? null,
            'colorFamily' => $p['colorFamily'] ?? null,
            'styleTags' => $p['styleTags'] ?? [],
            'occasionTags' => $p['occasionTags'] ?? [],
            'seasonality' => $p['seasonality'] ?? null,
        ];
    }
}

echo PHP_EOL . 'Step 1: OpenAIService::generateRecommendations(real candidates) ...' . PHP_EOL;
$probeStarted = microtime(true);
$probe = $openAi->generateRecommendations($probeConditions, $compactCandidates, $schemaJsonProbe);
$probeMs = (int) round((microtime(true) - $probeStarted) * 1000);
echo '  ok          : ' . (($probe['ok'] ?? false) ? 'true' : 'false') . PHP_EOL;
echo '  latency(ms) : ' . ($probe['latencyMs'] ?? $probeMs) . PHP_EOL;
if (($probe['ok'] ?? false) !== true) {
    echo '  error       : ' . ($probe['error'] ?? '(unknown)') . PHP_EOL;
    echo '  detail      : ' . ($probe['detail'] ?? '(none)') . PHP_EOL;
} else {
    echo '  modelName   : ' . ($probe['modelName'] ?? '(none)') . PHP_EOL;
    echo '  responseId  : ' . (isset($probe['modelResponseId']) ? substr((string) $probe['modelResponseId'], 0, 24) . '...' : '(none)') . PHP_EOL;
    echo '  usage       : ' . json_encode($probe['modelUsage'] ?? [], JSON_UNESCAPED_SLASHES) . PHP_EOL;
    $payload = $probe['data'] ?? [];

    echo PHP_EOL . 'Step 2: ResponseValidator::validateRecommendationOutput(real candidate IDs) ...' . PHP_EOL;
    $validation = $validator->validateRecommendationOutput($payload, $candidateIds);
    echo '  ok          : ' . (($validation['ok'] ?? false) ? 'true' : 'false') . PHP_EOL;
    if (($validation['ok'] ?? false) !== true) {
        echo '  error       : ' . ($validation['error'] ?? '(unknown)') . PHP_EOL;
        echo '  detail      : ' . ($validation['detail'] ?? '(none)') . PHP_EOL;
        echo '  model outfit dump (truncated):' . PHP_EOL;
        $outfits = $payload['outfits'] ?? [];
        foreach ($outfits as $i => $o) {
            if (!is_array($o)) { continue; }
            $ids = $o['productIdsBySlot'] ?? [];
            $alts = $o['alternativeProductIdsBySlot'] ?? [];
            $idsStr = is_array($ids) ? json_encode($ids, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : 'n/a';
            $altsStr = is_array($alts) ? json_encode($alts, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : 'n/a';
            echo "    [{$i}] rank=" . ($o['rank'] ?? '?')
                . " title='" . mb_substr((string)($o['title'] ?? ''), 0, 40) . "'"
                . " primary=" . $idsStr . PHP_EOL;
            echo "        alternatives=" . $altsStr . PHP_EOL;
        }
        echo '  Whitelist IDs: ' . implode(', ', $candidateIds) . PHP_EOL;
    } else {
        echo '  Validator accepted — generate() should now also use OpenAI path.' . PHP_EOL;
    }
}

$service = new RecommendationService(
    new ProductRepository($pdo),
    new RecommendationRepository($pdo),
    $openAi,
    $validator,
    $schemaJson,
);

$conditions = [
    'situation' => 'office',
    'budget' => '50k-100k',
    'mood' => ['clean', 'minimal'],
    'fit' => 'regular',
    'bodyType' => [],
    'colors' => [],
    'avoidances' => [],
    'freeText' => null,
];

echo PHP_EOL . 'Calling generate() ... (1 OpenAI request, no retries)' . PHP_EOL;
$startedAt = microtime(true);

try {
    $result = $service->generate($userId, $conditions, []);
    $elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);

    echo str_repeat('-', 60) . PHP_EOL;
    echo 'OK: generate() returned in ' . $elapsedMs . 'ms' . PHP_EOL;
    echo '  runId   : ' . $result['runId'] . PHP_EOL;
    echo '  source  : ' . $result['source'] . PHP_EOL;
    echo '  outfits : ' . count($result['outfits']) . PHP_EOL;

    foreach ($result['outfits'] as $idx => $outfit) {
        $items = count($outfit['items'] ?? []);
        $title = mb_substr((string) ($outfit['title'] ?? ''), 0, 40);
        $framing = mb_substr((string) ($outfit['framingLabel'] ?? '(none)'), 0, 30);
        $conf = $outfit['confidence'] ?? 'n/a';
        echo sprintf("    [%d] title=%-40s items=%d framing=%s confidence=%s",
            $idx, $title, $items, $framing, (string) $conf) . PHP_EOL;
    }

    $stmt = $pdo->prepare(
        'SELECT model_name, model_response_id, model_usage_json, confidence
         FROM recommendation_runs WHERE public_id = :publicId LIMIT 1'
    );
    $stmt->execute(['publicId' => $result['runId']]);
    $row = $stmt->fetch();

    echo str_repeat('-', 60) . PHP_EOL;
    echo 'DB recommendation_runs row:' . PHP_EOL;
    if ($row === false) {
        echo '  (row not found — should not happen)' . PHP_EOL;
    } else {
        echo '  model_name        : ' . ($row['model_name'] ?? '(null)') . PHP_EOL;
        $rid = $row['model_response_id'] ?? null;
        echo '  model_response_id : ' . ($rid === null ? '(null)' : (substr($rid, 0, 24) . '...')) . PHP_EOL;
        echo '  model_usage_json  : ' . ($row['model_usage_json'] ?? '(null)') . PHP_EOL;
        echo '  confidence        : ' . ($row['confidence'] ?? '(null)') . PHP_EOL;
    }
} catch (Throwable $e) {
    $elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);
    echo str_repeat('-', 60) . PHP_EOL;
    echo 'FAIL after ' . $elapsedMs . 'ms: ' . $e->getMessage() . PHP_EOL;
    echo '(typed errors and fallbacks are inside the service — exception here means an unexpected error)' . PHP_EOL;
}

echo str_repeat('-', 60) . PHP_EOL;
$pdo->exec('DELETE FROM users WHERE id = ' . $userId);
echo 'Cleanup: test user id=' . $userId . ' deleted (cascades to recommendation_runs).' . PHP_EOL;
