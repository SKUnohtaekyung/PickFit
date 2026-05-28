<?php

declare(strict_types=1);

/**
 * Safely inspect OpenAI configuration loaded by Config::fromEnvironment().
 * The raw API key is never printed — only presence, length, and a short prefix.
 *
 * Usage: php tests/manual/openai_env_check.php
 */

require __DIR__ . '/../../vendor/autoload.php';

use PickFit\Config;
use PickFit\Services\OpenAIService;

$config = Config::fromEnvironment(__DIR__ . '/../..');

$apiKey  = $config->openAiApiKey();
$model   = $config->openAiModel();
$timeout = $config->openAiTimeoutSeconds();
$extract = $config->openAiExtractionEnabled();

$keyReport = $apiKey === null
    ? 'MISSING (null)'
    : sprintf(
        'SET (prefix="%s...", length=%d, looks_like_openai_key=%s)',
        substr($apiKey, 0, 3),
        strlen($apiKey),
        str_starts_with($apiKey, 'sk-') ? 'yes' : 'no'
    );

$modelReport = $model === null ? 'MISSING (null)' : $model;

echo 'OPENAI_API_KEY            : ' . $keyReport . PHP_EOL;
echo 'OPENAI_MODEL              : ' . $modelReport . PHP_EOL;
echo 'OPENAI_TIMEOUT_SECONDS    : ' . $timeout . PHP_EOL;
echo 'OPENAI_EXTRACTION_ENABLED : ' . ($extract ? 'true' : 'false') . PHP_EOL;

$svc = new OpenAIService(
    $config,
    __DIR__ . '/../../src/Support/prompts',
    null,
);
echo 'OpenAIService::isAvailable(): ' . ($svc->isAvailable() ? 'true' : 'false') . PHP_EOL;

if ($apiKey === null) {
    echo PHP_EOL . 'WARN: API key missing — OpenAI branch will short-circuit and fallback runs.' . PHP_EOL;
    exit(0);
}

if ($model === null) {
    echo PHP_EOL . 'WARN: OPENAI_MODEL is empty. OpenAIService::isAvailable() will return false ' .
        'even though the key is set. Set e.g. OPENAI_MODEL=gpt-4o-mini in .env.' . PHP_EOL;
    exit(0);
}

echo PHP_EOL . 'OK: key + model present and OpenAIService recognises them.' . PHP_EOL;
