<?php

declare(strict_types=1);

namespace PickFit\Services;

use PickFit\Config;
use PickFit\Repositories\CrawlJobRepository;
use PickFit\Repositories\ProductRepository;
use PickFit\Support\ResponseValidator;
use RuntimeException;
use Throwable;

final class CrawlerService
{
    private const STDOUT_MAX_BYTES = 1_048_576;   // 1 MiB
    private const STDERR_MAX_BYTES = 16_384;      // 16 KiB
    private const KILL_GRACE_MS = 200;

    public function __construct(
        private readonly UrlSafetyService $urlSafety,
        private readonly CrawlJobRepository $jobs,
        private readonly ProductRepository $products,
        private readonly Config $config,
        private readonly string $projectRoot,
        private readonly string $storagePath,
        private readonly OpenAIService $openAi,
        private readonly ResponseValidator $validator,
        private readonly string $extractionSchemaJson,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function analyze(int $userId, string $rawUrl): array
    {
        $validation = $this->urlSafety->validate($rawUrl);

        if (!$validation['ok']) {
            $reason = $validation['reason'] ?? 'invalid_url';
            $message = $validation['message'] ?? 'URL을 사용할 수 없어요.';
            $normalized = $validation['normalizedUrl'] ?? $rawUrl;
            $domain = $validation['sourceDomain'] ?? $this->safeDomain($rawUrl);

            $created = $this->jobs->createQueued($userId, $rawUrl, $normalized, $domain);
            $this->jobs->markBlocked($created['id'], $reason, $message);

            return [
                'job' => $this->jobs->findByPublicId($created['publicId'], $userId),
                'blocked' => true,
                'reason' => $reason,
                'message' => $message,
            ];
        }

        $normalizedUrl = $validation['normalizedUrl'];
        $sourceDomain = $validation['sourceDomain'];

        $created = $this->jobs->createQueued($userId, $rawUrl, $normalizedUrl, $sourceDomain);
        $jobId = $created['id'];
        $publicId = $created['publicId'];

        $this->jobs->markRunning($jobId);

        $artifactDir = $this->storagePath
            . DIRECTORY_SEPARATOR . 'crawls'
            . DIRECTORY_SEPARATOR . $publicId;

        if (!is_dir($artifactDir) && !@mkdir($artifactDir, 0o755, true) && !is_dir($artifactDir)) {
            $this->jobs->markFailed($jobId, 'artifact_dir_failed', 'Could not create artifact directory.');
            return ['job' => $this->jobs->findByPublicId($publicId, $userId), 'blocked' => false];
        }

        $result = $this->runPlaywright($publicId, $normalizedUrl, $artifactDir);

        if ($result['timeout']) {
            $this->jobs->markFailed($jobId, 'crawl_timeout', '크롤링 시간이 초과됐어요.');
            return ['job' => $this->jobs->findByPublicId($publicId, $userId), 'blocked' => false];
        }

        $parsed = $this->parsePayload($result['stdout']);
        if ($parsed === null) {
            $this->jobs->markFailed($jobId, 'invalid_worker_output', $this->safeStderrTail($result['stderr']));
            return ['job' => $this->jobs->findByPublicId($publicId, $userId), 'blocked' => false];
        }

        if (($parsed['ok'] ?? false) !== true) {
            $errorCode = is_string($parsed['errorCode'] ?? null) ? $parsed['errorCode'] : 'extraction_failed';
            $errorMessage = is_string($parsed['errorMessage'] ?? null)
                ? $parsed['errorMessage']
                : '상품 페이지를 읽지 못했어요.';
            $this->jobs->markFailed($jobId, $errorCode, $errorMessage);
            return ['job' => $this->jobs->findByPublicId($publicId, $userId), 'blocked' => false];
        }

        $finalUrl = is_string($parsed['finalUrl'] ?? null) ? $parsed['finalUrl'] : $normalizedUrl;
        $finalValidation = $this->urlSafety->validate($finalUrl);
        if (!$finalValidation['ok']) {
            $this->jobs->markBlocked(
                $jobId,
                'post_navigation_blocked',
                $finalValidation['message'] ?? '리다이렉트된 주소가 차단됐어요.',
            );
            return ['job' => $this->jobs->findByPublicId($publicId, $userId), 'blocked' => true];
        }

        try {
            $productId = $this->products->upsertFromCrawl([
                'sourceUrl' => $finalUrl,
                'sourceDomain' => $finalValidation['sourceDomain'] ?? $sourceDomain,
                'originType' => 'user_url',
                'ownerUserId' => $userId,
                'crawlJobId' => $jobId,
                'productName' => $parsed['extracted']['productName'] ?? null,
                'brandName' => $parsed['extracted']['brandName'] ?? null,
                'description' => $parsed['extracted']['description'] ?? null,
                'priceCandidates' => $parsed['extracted']['priceCandidates'] ?? [],
                'currencyCandidates' => $parsed['extracted']['currencyCandidates'] ?? [],
                'heroImageUrl' => $this->pickHeroImage($parsed),
                'imageUrls' => $parsed['extracted']['imageUrls'] ?? [],
                'rawTextPreview' => $parsed['extracted']['text'] ?? null,
                'screenshotPath' => $parsed['artifacts']['screenshotPath'] ?? null,
            ]);
        } catch (RuntimeException $exception) {
            $this->jobs->markFailed($jobId, 'product_upsert_failed', $exception->getMessage());
            return ['job' => $this->jobs->findByPublicId($publicId, $userId), 'blocked' => false];
        }

        $this->maybeApplyOpenAiExtraction($productId, $parsed, $finalUrl);

        $artifactRelative = $this->relativeFromRoot($artifactDir);
        $this->jobs->markSucceeded($jobId, $parsed, $artifactRelative, $productId);

        return [
            'job' => $this->jobs->findByPublicId($publicId, $userId),
            'blocked' => false,
        ];
    }

    /**
     * Best-effort OpenAI normalization of the crawl payload. Failures are silent so they
     * never invalidate the underlying crawl record — the generic adapter result already
     * upserted by ProductRepository stays as-is.
     *
     * @param array<string, mixed> $parsed
     */
    private function maybeApplyOpenAiExtraction(int $productId, array $parsed, string $finalUrl): void
    {
        if (!$this->config->openAiExtractionEnabled()) {
            return;
        }
        if (!$this->openAi->isAvailable() || $this->extractionSchemaJson === '') {
            return;
        }

        $payload = $this->buildExtractionPayload($parsed, $finalUrl);
        $apiResult = $this->openAi->extractProductFields($payload, $this->extractionSchemaJson);
        if (($apiResult['ok'] ?? false) !== true || !isset($apiResult['data']) || !is_array($apiResult['data'])) {
            return;
        }

        $validation = $this->validator->validateProductExtraction($apiResult['data']);
        if (($validation['ok'] ?? false) !== true || !isset($validation['normalizedPayload']) || !is_array($validation['normalizedPayload'])) {
            return;
        }

        try {
            $this->products->applyOpenAiExtraction($productId, $validation['normalizedPayload']);
        } catch (Throwable) {
            // Swallow — the generic adapter result is already persisted and good enough.
        }
    }

    /**
     * @param array<string, mixed> $parsed Playwright worker JSON output
     * @return array<string, mixed>
     */
    private function buildExtractionPayload(array $parsed, string $finalUrl): array
    {
        $extracted = is_array($parsed['extracted'] ?? null) ? $parsed['extracted'] : [];
        $meta = is_array($parsed['meta'] ?? null) ? $parsed['meta'] : [];

        return [
            'finalUrl' => $finalUrl,
            'productName' => $extracted['productName'] ?? null,
            'brandName' => $extracted['brandName'] ?? null,
            'description' => $extracted['description'] ?? null,
            'priceCandidates' => $extracted['priceCandidates'] ?? [],
            'currencyCandidates' => $extracted['currencyCandidates'] ?? [],
            'imageUrls' => array_slice(is_array($extracted['imageUrls'] ?? null) ? $extracted['imageUrls'] : [], 0, 8),
            'text' => is_string($extracted['text'] ?? null) ? mb_substr($extracted['text'], 0, 6000) : null,
            'meta' => [
                'ogTitle' => $meta['ogTitle'] ?? null,
                'ogDescription' => $meta['ogDescription'] ?? null,
                'ogImage' => $meta['ogImage'] ?? null,
                'jsonLd' => $meta['jsonLd'] ?? null,
            ],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findJob(int $userId, string $publicId): ?array
    {
        return $this->jobs->findByPublicId($publicId, $userId);
    }

    /**
     * @return array{timeout: bool, stdout: string, stderr: string, exitCode: int}
     */
    private function runPlaywright(string $publicId, string $url, string $artifactDir): array
    {
        $nodeBinary = $this->config->get('NODE_BINARY', 'node') ?: 'node';
        $relativeScript = $this->config->get('PLAYWRIGHT_CRAWLER_PATH', 'crawler/playwright-crawl.js')
            ?: 'crawler/playwright-crawl.js';
        $scriptPath = $this->projectRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativeScript);
        $timeoutSeconds = max(5, (int) ($this->config->get('CRAWL_TIMEOUT_SECONDS', '45') ?: '45'));
        $maxTextChars = max(500, (int) ($this->config->get('CRAWL_MAX_TEXT_CHARS', '20000') ?: '20000'));
        $maxImages = max(1, (int) ($this->config->get('CRAWL_MAX_IMAGE_COUNT', '12') ?: '12'));

        $command = [
            $nodeBinary,
            $scriptPath,
            '--job-id', $publicId,
            '--url', $url,
            '--artifact-dir', $artifactDir,
            '--max-text-chars', (string) $maxTextChars,
            '--max-images', (string) $maxImages,
        ];

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        // Inherit the runtime environment but force-clear interactive/debug flags.
        // Playwright resolves its browser binaries via LOCALAPPDATA/APPDATA on Windows;
        // overriding PLAYWRIGHT_BROWSERS_PATH here would break that lookup, so we only
        // forward it when the parent process has explicitly set it.
        $passthrough = ['PATH', 'SystemRoot', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'HOMEPATH', 'HOMEDRIVE'];
        $env = ['PWDEBUG' => '0'];
        foreach ($passthrough as $key) {
            $value = getenv($key);
            if ($value !== false && $value !== '') {
                $env[$key] = $value;
            }
        }
        $browsersPath = getenv('PLAYWRIGHT_BROWSERS_PATH');
        if ($browsersPath !== false && $browsersPath !== '') {
            $env['PLAYWRIGHT_BROWSERS_PATH'] = $browsersPath;
        }

        $process = @proc_open($command, $descriptors, $pipes, $this->projectRoot, $env);
        if (!is_resource($process)) {
            return ['timeout' => false, 'stdout' => '', 'stderr' => 'proc_open_failed', 'exitCode' => -1];
        }

        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $stdout = '';
        $stderr = '';
        $startedAt = microtime(true);
        $timedOut = false;

        while (true) {
            $status = proc_get_status($process);

            $read = [];
            if (is_resource($pipes[1])) {
                $read[] = $pipes[1];
            }
            if (is_resource($pipes[2])) {
                $read[] = $pipes[2];
            }
            $write = null;
            $except = null;

            if ($read !== []) {
                $changed = @stream_select($read, $write, $except, 0, 500_000);
                if ($changed !== false && $changed > 0) {
                    foreach ($read as $stream) {
                        $chunk = @fread($stream, 8192);
                        if ($chunk === false || $chunk === '') {
                            continue;
                        }
                        if ($stream === $pipes[1]) {
                            if (strlen($stdout) < self::STDOUT_MAX_BYTES) {
                                $stdout .= $chunk;
                            }
                        } else {
                            if (strlen($stderr) < self::STDERR_MAX_BYTES) {
                                $stderr .= $chunk;
                            }
                        }
                    }
                }
            }

            if ($status['running'] === false) {
                break;
            }

            if ((microtime(true) - $startedAt) > $timeoutSeconds) {
                proc_terminate($process, 9);
                usleep(self::KILL_GRACE_MS * 1000);
                $timedOut = true;
                break;
            }
        }

        // Final drain after process exit / kill.
        foreach ([$pipes[1], $pipes[2]] as $idx => $stream) {
            if (!is_resource($stream)) {
                continue;
            }
            $remaining = stream_get_contents($stream);
            if (is_string($remaining)) {
                if ($idx === 0 && strlen($stdout) < self::STDOUT_MAX_BYTES) {
                    $stdout .= substr($remaining, 0, self::STDOUT_MAX_BYTES - strlen($stdout));
                } elseif ($idx === 1 && strlen($stderr) < self::STDERR_MAX_BYTES) {
                    $stderr .= substr($remaining, 0, self::STDERR_MAX_BYTES - strlen($stderr));
                }
            }
            @fclose($stream);
        }

        $exitCode = proc_close($process);

        return [
            'timeout' => $timedOut,
            'stdout' => $stdout,
            'stderr' => $stderr,
            'exitCode' => $exitCode,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function parsePayload(string $stdout): ?array
    {
        $stdout = trim($stdout);
        if ($stdout === '') {
            return null;
        }
        // Strip leading BOM if any tooling injected one.
        if (str_starts_with($stdout, "\xEF\xBB\xBF")) {
            $stdout = substr($stdout, 3);
        }
        try {
            $decoded = json_decode($stdout, true, 16, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }
        return is_array($decoded) ? $decoded : null;
    }

    private function pickHeroImage(array $payload): ?string
    {
        $extracted = is_array($payload['extracted'] ?? null) ? $payload['extracted'] : [];
        $images = is_array($extracted['imageUrls'] ?? null) ? $extracted['imageUrls'] : [];
        foreach ($images as $url) {
            if (is_string($url) && $url !== '') {
                return $url;
            }
        }
        $ogImage = $payload['meta']['ogImage'] ?? null;
        return is_string($ogImage) && $ogImage !== '' ? $ogImage : null;
    }

    private function safeDomain(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST);
        return is_string($host) && $host !== '' ? strtolower($host) : 'unknown';
    }

    private function safeStderrTail(string $stderr): string
    {
        $stderr = trim($stderr);
        if ($stderr === '') {
            return 'Worker did not produce a valid response.';
        }
        $tail = mb_substr($stderr, -300);
        // Strip control characters and ANSI sequences before persisting.
        $tail = preg_replace('/\e\[[0-9;]*[A-Za-z]/', '', $tail) ?? $tail;
        $tail = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $tail) ?? $tail;
        return 'Worker output was not valid JSON. tail: ' . $tail;
    }

    private function relativeFromRoot(string $absolute): string
    {
        $root = rtrim($this->projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        if (str_starts_with($absolute, $root)) {
            return str_replace(DIRECTORY_SEPARATOR, '/', substr($absolute, strlen($root)));
        }
        return $absolute;
    }
}
