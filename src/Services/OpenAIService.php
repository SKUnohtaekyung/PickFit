<?php

declare(strict_types=1);

namespace PickFit\Services;

use PickFit\Config;

/**
 * OpenAI Responses API client with Structured Outputs (strict JSON Schema).
 *
 * - API key, model, timeout are read from {@see Config}. No hardcoded model names.
 * - Returns a discriminated result array. Raw model output never escapes this class
 *   except through the optional file logger (which writes to a configured directory).
 * - Schema files and system prompts are loaded from disk by the caller (schema) and
 *   this service (prompts) respectively, keeping the HTTP layer pure.
 */
final class OpenAIService
{
    private const ENDPOINT = 'https://api.openai.com/v1/responses';
    private const MIN_TIMEOUT = 5;
    private const REFUSAL_DETAIL_LIMIT = 200;
    private const RAW_LOG_LIMIT = 8000;

    public function __construct(
        private readonly Config $config,
        private readonly string $promptsDirectory,
        private readonly ?string $logDirectory = null,
        private readonly ?string $caCertPath = null,
    ) {
    }

    public function isAvailable(): bool
    {
        return $this->config->openAiApiKey() !== null
            && $this->config->openAiModel() !== null;
    }

    /**
     * Normalize a raw crawl payload into the strict product_extraction schema.
     *
     * @param array<string, mixed> $crawlResult
     * @return array{
     *     ok: bool,
     *     data?: array<string, mixed>,
     *     error?: string,
     *     detail?: string,
     *     modelResponseId?: ?string,
     *     modelName?: ?string,
     *     modelUsage?: array<string, int>,
     *     latencyMs?: int
     * }
     */
    public function extractProductFields(array $crawlResult, string $schemaJson): array
    {
        $apiKey = $this->config->openAiApiKey();
        $model = $this->config->openAiModel();
        if ($apiKey === null || $model === null) {
            return ['ok' => false, 'error' => 'openai_unavailable'];
        }

        $systemPrompt = $this->loadPrompt('extraction_system.txt');
        if ($systemPrompt === null) {
            return ['ok' => false, 'error' => 'openai_prompt_missing'];
        }

        $userJson = json_encode(
            ['crawlResult' => $crawlResult],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
        if ($userJson === false) {
            return ['ok' => false, 'error' => 'openai_payload_encode_failed'];
        }

        return $this->callResponsesApi(
            $apiKey,
            $model,
            $systemPrompt,
            $userJson,
            'product_extraction',
            $schemaJson,
        );
    }

    /**
     * Generate three outfit recommendations from candidates.
     *
     * @param array<string, mixed> $conditions
     * @param array<int|string, mixed> $candidates
     * @return array{
     *     ok: bool,
     *     data?: array<string, mixed>,
     *     error?: string,
     *     detail?: string,
     *     modelResponseId?: ?string,
     *     modelName?: ?string,
     *     modelUsage?: array<string, int>,
     *     latencyMs?: int
     * }
     */
    public function generateRecommendations(array $conditions, array $candidates, string $schemaJson): array
    {
        $apiKey = $this->config->openAiApiKey();
        $model = $this->config->openAiModel();
        if ($apiKey === null || $model === null) {
            return ['ok' => false, 'error' => 'openai_unavailable'];
        }

        $systemPrompt = $this->loadPrompt('recommendation_system.txt');
        if ($systemPrompt === null) {
            return ['ok' => false, 'error' => 'openai_prompt_missing'];
        }

        $userJson = json_encode(
            [
                'conditions' => $conditions,
                'candidates' => $candidates,
            ],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
        if ($userJson === false) {
            return ['ok' => false, 'error' => 'openai_payload_encode_failed'];
        }

        return $this->callResponsesApi(
            $apiKey,
            $model,
            $systemPrompt,
            $userJson,
            'recommendation',
            $schemaJson,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function callResponsesApi(
        string $apiKey,
        string $model,
        string $systemPrompt,
        string $userJson,
        string $schemaName,
        string $schemaJson,
    ): array {
        $schema = json_decode($schemaJson, true);
        if (!is_array($schema)) {
            return ['ok' => false, 'error' => 'openai_invalid_schema'];
        }

        $body = [
            'model' => $model,
            'input' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userJson],
            ],
            'text' => [
                'format' => [
                    'type' => 'json_schema',
                    'name' => $schemaName,
                    'schema' => $schema,
                    'strict' => true,
                ],
            ],
        ];

        // temperature/seed는 설정된 경우에만 바디에 포함(옵트인). 미지원 모델에서
        // 불필요한 키로 400을 유발하지 않도록 한다.
        $temperature = $this->config->openAiTemperature();
        if ($temperature !== null) {
            $body['temperature'] = $temperature;
        }
        $seed = $this->config->openAiSeed();
        if ($seed !== null) {
            $body['seed'] = $seed;
        }

        $bodyJson = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($bodyJson === false) {
            return ['ok' => false, 'error' => 'openai_payload_encode_failed'];
        }

        $timeout = max(self::MIN_TIMEOUT, $this->config->openAiTimeoutSeconds());
        $startedAt = microtime(true);

        $ch = curl_init(self::ENDPOINT);
        if ($ch === false) {
            return ['ok' => false, 'error' => 'openai_curl_init_failed'];
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_POSTFIELDS => $bodyJson,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
                'Accept: application/json',
            ],
        ]);
        if ($this->caCertPath !== null && is_file($this->caCertPath)) {
            curl_setopt($ch, CURLOPT_CAINFO, $this->caCertPath);
        }

        $rawResponse = curl_exec($ch);
        $errno = curl_errno($ch);
        $httpStatus = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        // curl_close() is a no-op since PHP 8.0 and deprecated in 8.5; rely on GC.

        $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);

        if ($rawResponse === false || $errno !== 0) {
            $detail = $errno === CURLE_OPERATION_TIMEDOUT ? 'timeout' : ('curl_errno_' . $errno);
            return [
                'ok' => false,
                'error' => 'openai_unavailable',
                'detail' => $detail,
                'latencyMs' => $latencyMs,
            ];
        }

        $rawString = is_string($rawResponse) ? $rawResponse : '';
        $this->logRawResponse($schemaName, $rawString, $httpStatus);

        if ($httpStatus === 401 || $httpStatus === 403) {
            return [
                'ok' => false,
                'error' => 'openai_auth_failed',
                'detail' => 'http_' . $httpStatus,
                'latencyMs' => $latencyMs,
            ];
        }

        if ($httpStatus === 429) {
            return [
                'ok' => false,
                'error' => 'openai_rate_limited',
                'detail' => 'http_429',
                'latencyMs' => $latencyMs,
            ];
        }

        if ($httpStatus >= 500) {
            return [
                'ok' => false,
                'error' => 'openai_unavailable',
                'detail' => 'http_' . $httpStatus,
                'latencyMs' => $latencyMs,
            ];
        }

        if ($httpStatus >= 400) {
            return [
                'ok' => false,
                'error' => 'openai_bad_request',
                'detail' => 'http_' . $httpStatus,
                'latencyMs' => $latencyMs,
            ];
        }

        $envelope = json_decode($rawString, true);
        if (!is_array($envelope)) {
            return [
                'ok' => false,
                'error' => 'openai_empty_response',
                'latencyMs' => $latencyMs,
            ];
        }

        $parsed = $this->parseStructuredResponse($envelope);
        if (!$parsed['ok']) {
            $parsed['latencyMs'] = $latencyMs;
            return $parsed;
        }

        return [
            'ok' => true,
            'data' => $parsed['data'],
            'modelResponseId' => is_string($envelope['id'] ?? null) ? $envelope['id'] : null,
            'modelName' => is_string($envelope['model'] ?? null) ? $envelope['model'] : $model,
            'modelUsage' => $this->normalizeUsage($envelope['usage'] ?? null),
            'latencyMs' => $latencyMs,
        ];
    }

    /**
     * @param array<string, mixed> $envelope
     * @return array{ok: bool, data?: array<string, mixed>, error?: string, detail?: string}
     */
    private function parseStructuredResponse(array $envelope): array
    {
        $output = $envelope['output'] ?? [];
        if (!is_array($output)) {
            $output = [];
        }

        foreach ($output as $item) {
            if (!is_array($item)) {
                continue;
            }
            $content = $item['content'] ?? [];
            if (!is_array($content)) {
                continue;
            }
            foreach ($content as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                if (($entry['type'] ?? null) === 'refusal') {
                    $refusalText = is_string($entry['refusal'] ?? null) ? $entry['refusal'] : '';
                    return [
                        'ok' => false,
                        'error' => 'openai_schema_violation',
                        'detail' => $this->truncate('refusal: ' . $refusalText, self::REFUSAL_DETAIL_LIMIT),
                    ];
                }
            }
        }

        $outputText = null;
        if (is_string($envelope['output_text'] ?? null)) {
            $outputText = $envelope['output_text'];
        }
        if ($outputText === null) {
            foreach ($output as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $content = $item['content'] ?? [];
                if (!is_array($content)) {
                    continue;
                }
                foreach ($content as $entry) {
                    if (!is_array($entry)) {
                        continue;
                    }
                    if (($entry['type'] ?? null) === 'output_text' && is_string($entry['text'] ?? null)) {
                        $outputText = $entry['text'];
                        break 2;
                    }
                }
            }
        }

        if (!is_string($outputText) || $outputText === '') {
            return ['ok' => false, 'error' => 'openai_empty_response'];
        }

        $decoded = json_decode($outputText, true);
        if (!is_array($decoded)) {
            return [
                'ok' => false,
                'error' => 'openai_schema_violation',
                'detail' => 'output_text_not_json',
            ];
        }

        return ['ok' => true, 'data' => $decoded];
    }

    private function loadPrompt(string $filename): ?string
    {
        $path = $this->promptsDirectory . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($path)) {
            return null;
        }
        $content = @file_get_contents($path);
        if ($content === false || $content === '') {
            return null;
        }
        return $content;
    }

    /**
     * 구조화 이벤트 로그(추천 fallback 사유 등)를 일별 로그에 한 줄 기록한다.
     * logDirectory 미설정 시 무동작(운영 환경 외에서는 조용히 패스).
     *
     * @param array<string, mixed> $context
     */
    public function logEvent(string $kind, array $context = []): void
    {
        if ($this->logDirectory === null) {
            return;
        }
        $dir = $this->logDirectory;
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return;
        }
        $logPath = $dir . DIRECTORY_SEPARATOR . date('Y-m-d') . '.log';
        $entry = json_encode(
            ['ts' => date(DATE_ATOM), 'kind' => $kind, 'context' => $context],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
        if ($entry !== false) {
            @file_put_contents($logPath, $entry . PHP_EOL, FILE_APPEND);
        }
    }

    private function logRawResponse(string $kind, string $rawResponse, int $httpStatus): void
    {
        if ($this->logDirectory === null) {
            return;
        }
        $dir = $this->logDirectory;
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return;
        }
        $logPath = $dir . DIRECTORY_SEPARATOR . date('Y-m-d') . '.log';
        $entry = json_encode(
            [
                'ts' => date(DATE_ATOM),
                'kind' => $kind,
                'httpStatus' => $httpStatus,
                'rawResponse' => $this->truncate($rawResponse, self::RAW_LOG_LIMIT),
            ],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
        if ($entry !== false) {
            @file_put_contents($logPath, $entry . PHP_EOL, FILE_APPEND);
        }
    }

    private function truncate(string $value, int $maxLen): string
    {
        if (mb_strlen($value, 'UTF-8') <= $maxLen) {
            return $value;
        }
        return mb_substr($value, 0, $maxLen, 'UTF-8') . '…';
    }

    /**
     * @return array<string, int>
     */
    private function normalizeUsage(mixed $usage): array
    {
        if (!is_array($usage)) {
            return [];
        }
        $out = [];
        foreach (['input_tokens', 'output_tokens', 'total_tokens'] as $key) {
            $value = $usage[$key] ?? null;
            if (is_int($value)) {
                $out[$key] = $value;
            }
        }
        return $out;
    }
}
