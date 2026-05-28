<?php

declare(strict_types=1);

/**
 * Phase 1-4 smoke test for OpenAI integration foundations.
 *
 * Runs without any OpenAI API key — exercises Config getters, OpenAIService
 * availability gating, schema file shape, prompt files, and ResponseValidator
 * across the 4 Phase 4 cases plus a few extras.
 *
 * Run: php tests/manual/openai_phase14_smoke.php
 * Exits non-zero on any failed assertion.
 */

require __DIR__ . '/../../vendor/autoload.php';

use PickFit\Config;
use PickFit\Services\OpenAIService;
use PickFit\Support\ResponseValidator;

$pass = 0;
$fail = 0;
$lines = [];

function assertEq(string $label, mixed $expected, mixed $actual): void
{
    global $pass, $fail, $lines;
    $ok = $expected === $actual;
    if ($ok) {
        $pass++;
        $lines[] = "PASS  $label";
    } else {
        $fail++;
        $lines[] = "FAIL  $label\n      expected=" . var_export($expected, true)
            . "\n      actual=" . var_export($actual, true);
    }
}

// ---------- Config ----------
$emptyConfig = new Config([]);
assertEq('Config: empty -> openAiApiKey is null',  null, $emptyConfig->openAiApiKey());
assertEq('Config: empty -> openAiModel is null',   null, $emptyConfig->openAiModel());
assertEq('Config: empty -> timeout defaults to 60', 60,  $emptyConfig->openAiTimeoutSeconds());

$blankConfig = new Config([
    'OPENAI_API_KEY' => '',
    'OPENAI_MODEL' => '',
    'OPENAI_TIMEOUT_SECONDS' => '',
]);
assertEq('Config: blank -> openAiApiKey is null',  null, $blankConfig->openAiApiKey());
assertEq('Config: blank -> openAiModel is null',   null, $blankConfig->openAiModel());
assertEq('Config: blank -> timeout defaults to 60', 60,  $blankConfig->openAiTimeoutSeconds());

$setConfig = new Config([
    'OPENAI_API_KEY' => 'sk-test',
    'OPENAI_MODEL' => 'gpt-test',
    'OPENAI_TIMEOUT_SECONDS' => '30',
]);
assertEq('Config: set -> openAiApiKey returns string', 'sk-test',  $setConfig->openAiApiKey());
assertEq('Config: set -> openAiModel returns string',  'gpt-test', $setConfig->openAiModel());
assertEq('Config: set -> timeout returns integer',     30,         $setConfig->openAiTimeoutSeconds());

$negTimeoutConfig = new Config(['OPENAI_TIMEOUT_SECONDS' => '-5']);
assertEq('Config: negative timeout -> fallback to 60', 60, $negTimeoutConfig->openAiTimeoutSeconds());

// Phase 6 extraction flag (default false; true when explicitly set; case-insensitive)
$flagDefault = new Config([]);
assertEq('Config: openAiExtractionEnabled default=false', false, $flagDefault->openAiExtractionEnabled());
$flagOn = new Config(['OPENAI_EXTRACTION_ENABLED' => 'true']);
assertEq('Config: openAiExtractionEnabled="true" -> true', true, $flagOn->openAiExtractionEnabled());
$flagOff = new Config(['OPENAI_EXTRACTION_ENABLED' => 'false']);
assertEq('Config: openAiExtractionEnabled="false" -> false', false, $flagOff->openAiExtractionEnabled());
$flagBlank = new Config(['OPENAI_EXTRACTION_ENABLED' => '']);
assertEq('Config: openAiExtractionEnabled="" -> false', false, $flagBlank->openAiExtractionEnabled());

// ---------- OpenAIService availability ----------
$promptsDir = __DIR__ . '/../../src/Support/prompts';
$svcEmpty = new OpenAIService($emptyConfig, $promptsDir, null);
$svcSet = new OpenAIService($setConfig, $promptsDir, null);
assertEq('OpenAIService: isAvailable=false when key absent', false, $svcEmpty->isAvailable());
assertEq('OpenAIService: isAvailable=true when key+model set', true, $svcSet->isAvailable());

$resUnavailable = $svcEmpty->extractProductFields(['raw' => 'x'], '{}');
assertEq('OpenAIService: extractProductFields ok=false when unavailable', false, $resUnavailable['ok']);
assertEq('OpenAIService: extractProductFields error=openai_unavailable', 'openai_unavailable', $resUnavailable['error'] ?? null);

$resUnavail2 = $svcEmpty->generateRecommendations([], [], '{}');
assertEq('OpenAIService: generateRecommendations ok=false when unavailable', false, $resUnavail2['ok']);
assertEq('OpenAIService: generateRecommendations error=openai_unavailable', 'openai_unavailable', $resUnavail2['error'] ?? null);

// ---------- Schema files ----------
$schemasDir = __DIR__ . '/../../src/Support/schemas';
$extractionRaw = @file_get_contents($schemasDir . '/product_extraction.schema.json');
$recommendRaw = @file_get_contents($schemasDir . '/recommendation.schema.json');
assertEq('Schema: product_extraction file loads',  true, is_string($extractionRaw) && $extractionRaw !== '');
assertEq('Schema: recommendation file loads',      true, is_string($recommendRaw) && $recommendRaw !== '');

$extraction = json_decode($extractionRaw ?: '', true);
$recommend  = json_decode($recommendRaw ?: '', true);
assertEq('Schema: product_extraction parses to array', true, is_array($extraction));
assertEq('Schema: recommendation parses to array',     true, is_array($recommend));
assertEq('Schema: product_extraction type=object',          'object', $extraction['type'] ?? null);
assertEq('Schema: recommendation type=object',              'object', $recommend['type'] ?? null);
assertEq('Schema: product_extraction additionalProperties=false', false, $extraction['additionalProperties'] ?? null);
assertEq('Schema: recommendation additionalProperties=false',     false, $recommend['additionalProperties'] ?? null);

// Required-array completeness for strict mode (every defined property must be required).
$extractionProps = array_keys($extraction['properties'] ?? []);
$extractionRequired = $extraction['required'] ?? [];
assertEq('Schema: product_extraction required==properties (strict mode)',
    [], array_values(array_diff($extractionProps, $extractionRequired)));

$recommendProps = array_keys($recommend['properties'] ?? []);
$recommendRequired = $recommend['required'] ?? [];
assertEq('Schema: recommendation required==properties (strict mode)',
    [], array_values(array_diff($recommendProps, $recommendRequired)));

// ---------- Prompt files ----------
$extractionPromptOk = is_file($promptsDir . '/extraction_system.txt')
    && filesize($promptsDir . '/extraction_system.txt') > 200;
$recommendPromptOk = is_file($promptsDir . '/recommendation_system.txt')
    && filesize($promptsDir . '/recommendation_system.txt') > 200;
assertEq('Prompts: extraction_system.txt non-trivial',  true, $extractionPromptOk);
assertEq('Prompts: recommendation_system.txt non-trivial', true, $recommendPromptOk);

// ---------- ResponseValidator ----------
$validator = new ResponseValidator();

$makeOutfit = static function (int $rank, array $primaryIds = [], array $altIds = [], float $confidence = 0.7): array {
    $primary = ['top' => null, 'bottom' => null, 'outer' => null, 'shoes' => null];
    foreach ($primaryIds as $slot => $id) {
        $primary[$slot] = $id;
    }
    $alternatives = ['top' => [], 'bottom' => [], 'outer' => [], 'shoes' => []];
    foreach ($altIds as $slot => $ids) {
        $alternatives[$slot] = $ids;
    }
    return [
        'rank' => $rank,
        'title' => "Outfit $rank",
        'framingLabel' => 'situation-focused',
        'summary' => 'demo summary',
        'productIdsBySlot' => $primary,
        'alternativeProductIdsBySlot' => $alternatives,
        'reasons' => ['이유 1', '이유 2'],
        'risks' => [['type' => 'info', 'text' => '데이터 부족']],
        'reviewEvidence' => '리뷰 데이터 부족',
        'comparison' => [
            'price' => '50000원',
            'fit' => '정사이즈',
            'material' => '코튼',
            'season' => '봄/가을',
            'shipping' => '정보 부족',
            'returnFee' => '정보 부족',
            'reviewSummary' => '정보 부족',
            'fitRisk' => '중간',
        ],
        'confidence' => $confidence,
    ];
};

$candidates = ['p1', 'p2', 'p3', 'p4'];

// Case 1: normal
$payload1 = [
    'confidence' => 0.7,
    'globalWarnings' => [],
    'outfits' => [
        $makeOutfit(1, ['top' => 'p1', 'bottom' => 'p2'], ['top' => ['p3']]),
        $makeOutfit(2, ['top' => 'p2', 'bottom' => 'p3']),
        $makeOutfit(3, ['top' => 'p4', 'bottom' => 'p1']),
    ],
];
$r1 = $validator->validateRecommendationOutput($payload1, $candidates);
assertEq('Validator case 1 (normal): ok=true', true, $r1['ok']);

// Case 2: only 2 outfits
$payload2 = $payload1;
array_pop($payload2['outfits']);
$r2 = $validator->validateRecommendationOutput($payload2, $candidates);
assertEq('Validator case 2 (2 outfits): ok=false', false, $r2['ok']);
assertEq('Validator case 2: error=outfit_count_mismatch', 'outfit_count_mismatch', $r2['error'] ?? null);

// Case 3: unknown product id
$payload3 = $payload1;
$payload3['outfits'][0]['productIdsBySlot']['top'] = 'p999';
$r3 = $validator->validateRecommendationOutput($payload3, $candidates);
assertEq('Validator case 3 (unknown id): ok=false', false, $r3['ok']);
assertEq('Validator case 3: error=unknown_product_id', 'unknown_product_id', $r3['error'] ?? null);
assertEq('Validator case 3: detail=p999', 'p999', $r3['detail'] ?? null);

// Case 4: confidence > 1
$payload4 = $payload1;
$payload4['confidence'] = 1.5;
$r4 = $validator->validateRecommendationOutput($payload4, $candidates);
assertEq('Validator case 4 (confidence>1): ok=false', false, $r4['ok']);
assertEq('Validator case 4: error=schema_range_violation', 'schema_range_violation', $r4['error'] ?? null);

// Bonus: duplicate rank
$payload5 = $payload1;
$payload5['outfits'][1]['rank'] = 1;
$r5 = $validator->validateRecommendationOutput($payload5, $candidates);
assertEq('Validator bonus (duplicate rank): ok=false', false, $r5['ok']);
assertEq('Validator bonus: error=duplicate_rank', 'duplicate_rank', $r5['error'] ?? null);

// Bonus: unknown id in alternativeProductIdsBySlot
$payload6 = $payload1;
$payload6['outfits'][0]['alternativeProductIdsBySlot']['top'] = ['p2', 'p_ghost'];
$r6 = $validator->validateRecommendationOutput($payload6, $candidates);
assertEq('Validator bonus (alt unknown id): ok=false', false, $r6['ok']);
assertEq('Validator bonus: alt error=unknown_product_id', 'unknown_product_id', $r6['error'] ?? null);

// Product extraction: normal
$extractionOk = [
    'productName' => '슬랙스',
    'brandName' => 'PickFit',
    'categoryMain' => 'bottom',
    'categorySub' => '슬랙스',
    'priceSale' => 50000,
    'currency' => 'KRW',
    'fitType' => 'regular',
    'materialMain' => '울',
    'materialSub' => null,
    'thickness' => 'medium',
    'opacity' => 'opaque',
    'stretch' => 'low',
    'colorFamily' => '네이비',
    'seasonality' => ['fall', 'winter'],
    'styleTags' => ['오피스'],
    'occasionTags' => ['출근'],
    'shippingSummary' => null,
    'returnSummary' => null,
    'reviewSummary' => null,
    'riskFlags' => [],
    'confidence' => 0.85,
    'missingFields' => ['shippingSummary'],
    'warnings' => [],
];
$re1 = $validator->validateProductExtraction($extractionOk);
assertEq('Validator extraction (normal): ok=true', true, $re1['ok']);

// Product extraction: bad enum
$extractionBadEnum = $extractionOk;
$extractionBadEnum['categoryMain'] = 'wrong_category';
$re2 = $validator->validateProductExtraction($extractionBadEnum);
assertEq('Validator extraction (bad enum): ok=false', false, $re2['ok']);
assertEq('Validator extraction (bad enum): error=schema_enum_violation', 'schema_enum_violation', $re2['error'] ?? null);

// Product extraction: missing field
$extractionMissing = $extractionOk;
unset($extractionMissing['confidence']);
$re3 = $validator->validateProductExtraction($extractionMissing);
assertEq('Validator extraction (missing field): ok=false', false, $re3['ok']);
assertEq('Validator extraction (missing field): error=schema_missing_field', 'schema_missing_field', $re3['error'] ?? null);

// Output
foreach ($lines as $line) {
    echo $line . PHP_EOL;
}
echo str_repeat('-', 60) . PHP_EOL;
echo sprintf("TOTAL: %d pass, %d fail%s", $pass, $fail, PHP_EOL);
exit($fail === 0 ? 0 : 1);
