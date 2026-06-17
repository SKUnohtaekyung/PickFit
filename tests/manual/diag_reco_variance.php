<?php

declare(strict_types=1);

/**
 * Diagnostic: run RecommendationService.generate() across several condition sets
 * and print, for each, the source (openai/fallback) and the product publicIds
 * chosen per outfit/slot. Lets us see which conditions actually change picks.
 *
 * Runs every condition set through TWO services:
 *   [LIVE]     real OpenAIService + schema (production path; may call OpenAI)
 *   [FALLBACK] empty schema → forces deterministic assembleOutfits()
 *
 * Usage: php tests/manual/diag_reco_variance.php
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
$pdo = (new Database($config))->pdo();

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

$liveService = new RecommendationService(
    new ProductRepository($pdo),
    new RecommendationRepository($pdo),
    $openAi,
    new ResponseValidator(),
    $schemaJson,
);
// Empty schema forces the deterministic fallback (assembleOutfits).
$fallbackService = new RecommendationService(
    new ProductRepository($pdo),
    new RecommendationRepository($pdo),
    $openAi,
    new ResponseValidator(),
    '',
);

echo 'OpenAI available: ' . ($openAi->isAvailable() ? 'YES' : 'NO') . PHP_EOL;
echo 'Schema bytes    : ' . strlen($schemaJson) . PHP_EOL . PHP_EOL;

$base = [
    'situation' => 'office', 'budget' => 'under50k', 'fit' => 'slim',
    'mood' => ['minimal'], 'bodyType' => [], 'colors' => [], 'avoidances' => [], 'freeText' => null,
];
$cases = [
    'A base (office/under50k/slim/minimal)'        => $base,
    'B vary SITUATION only -> date'                => ['situation' => 'date'] + $base,
    'C vary BUDGET only -> over200k'               => ['budget' => 'over200k'] + $base,
    'D vary FIT only -> oversized'                 => ['fit' => 'oversized'] + $base,
    'E vary MOOD only -> street'                   => ['mood' => ['street']] + $base,
    'F vary AVOIDANCES only -> tight'              => ['avoidances' => ['tight']] + $base,
    'G vary COLORS only -> black'                  => ['colors' => ['black']] + $base,
    'H vary BODYTYPE only -> apple'                => ['bodyType' => ['apple']] + $base,
    'Z all different (date/over200k/oversized...)' => [
        'situation' => 'date', 'budget' => 'over200k', 'fit' => 'oversized',
        'mood' => ['street'], 'bodyType' => ['apple'], 'colors' => ['black'], 'avoidances' => ['tight'], 'freeText' => null,
    ],
];

/** Compact signature: per-outfit "slot:pubid" joined. */
$sig = static function (array $result): string {
    $lines = [];
    foreach ($result['outfits'] as $i => $o) {
        $parts = [];
        foreach ($o['items'] as $it) {
            $parts[] = $it['slot'] . ':' . substr((string) $it['productPublicId'], 0, 10);
        }
        $lines[] = '   #' . ($i + 1) . ' [' . ($o['title'] ?? '') . '] ' . implode('  ', $parts);
    }
    return implode(PHP_EOL, $lines);
};

foreach (['FALLBACK' => $fallbackService, 'LIVE' => $liveService] as $label => $service) {
    echo str_repeat('=', 70) . PHP_EOL;
    echo "PATH: $label" . PHP_EOL;
    echo str_repeat('=', 70) . PHP_EOL;
    $sigs = [];
    foreach ($cases as $name => $cond) {
        try {
            $r = $service->generate($userId, $cond, []);
            $s = $sig($r);
            $sigs[$name] = $s;
            echo $name . '  (source=' . $r['source'] . ')' . PHP_EOL;
            echo $s . PHP_EOL . PHP_EOL;
        } catch (Throwable $e) {
            echo $name . '  -> ERROR: ' . $e->getMessage() . PHP_EOL . PHP_EOL;
            $sigs[$name] = 'ERR';
        }
    }
    // How many distinct outfit-sets did the 9 cases produce?
    $distinct = array_unique(array_values($sigs));
    echo "--> distinct outfit-sets across " . count($sigs) . " cases: " . count($distinct) . PHP_EOL . PHP_EOL;
}

$pdo->exec('DELETE FROM users WHERE id = ' . $userId);
echo "Cleanup: test user $userId deleted." . PHP_EOL;
