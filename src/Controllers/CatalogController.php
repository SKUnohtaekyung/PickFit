<?php

declare(strict_types=1);

namespace PickFit\Controllers;

use InvalidArgumentException;
use PickFit\Http\Request;
use PickFit\Http\Response;
use PickFit\Repositories\ProductRepository;
use PickFit\Services\CrawlerService;

final class CatalogController
{
    public function __construct(
        private readonly ProductRepository $products,
        private readonly ?CrawlerService $crawler = null,
    ) {
    }

    public function index(Request $request): Response
    {
        $limit = $this->limit($request->query('limit'));
        $maxPrice = $this->positiveIntOrNull($request->query('maxPrice'));
        $result = $this->products->list(
            $request->query('category'),
            $request->query('situation'),
            $request->query('style'),
            $maxPrice,
            $limit,
            $request->query('cursor'),
        );

        return $this->success([
            'products' => $result['items'],
            'nextCursor' => $result['nextCursor'],
        ]);
    }

    public function show(string $id): Response
    {
        $product = $this->products->findByPublicId($id);
        if ($product === null) {
            return Response::json([
                'ok' => false,
                'error' => [
                    'code' => 'not_found',
                    'message' => 'Product not found.',
                ],
                'meta' => $this->meta(),
            ], 404);
        }

        return $this->success([
            'product' => $product,
        ]);
    }

    /**
     * @param array<string, mixed> $sessionUser
     */
    public function analyzeUrl(Request $request, array $sessionUser): Response
    {
        if ($this->crawler === null) {
            return $this->error('crawler_unavailable', 'Crawler service is not configured.', 503);
        }

        try {
            $payload = $request->json();
        } catch (InvalidArgumentException) {
            return $this->error('validation_failed', 'Request body must be a JSON object.', 422);
        }

        $url = $payload['url'] ?? null;
        if (!is_string($url) || $url === '') {
            return $this->error('validation_failed', 'url is required.', 422);
        }
        if (strlen($url) > 2048) {
            return $this->error('blocked_url', 'URL이 너무 길어요.', 422);
        }

        $result = $this->crawler->analyze((int) $sessionUser['userId'], $url);
        $job = $result['job'] ?? null;

        if (!is_array($job)) {
            return $this->error('crawl_failed', '잡 상태를 가져오지 못했어요.', 500);
        }

        if (($result['blocked'] ?? false) === true) {
            return Response::json([
                'ok' => false,
                'error' => [
                    'code' => 'blocked_url',
                    'message' => $result['message'] ?? '이 주소는 분석할 수 없어요.',
                ],
                'data' => ['job' => $this->shapeJob($job)],
                'meta' => $this->meta(),
            ], 422);
        }

        $status = $job['status'] ?? 'queued';
        $httpStatus = $status === 'succeeded' ? 201 : 200;
        return Response::json([
            'ok' => $status !== 'failed',
            'data' => ['job' => $this->shapeJob($job)],
            'meta' => $this->meta(),
        ], $httpStatus);
    }

    /**
     * @param array<string, mixed> $sessionUser
     */
    public function showCrawlJob(string $publicId, array $sessionUser): Response
    {
        if ($this->crawler === null) {
            return $this->error('crawler_unavailable', 'Crawler service is not configured.', 503);
        }
        $job = $this->crawler->findJob((int) $sessionUser['userId'], $publicId);
        if (!is_array($job)) {
            return $this->error('not_found', 'Crawl job not found.', 404);
        }
        return $this->success(['job' => $this->shapeJob($job)]);
    }

    /**
     * @param array<string, mixed> $job
     * @return array<string, mixed>
     */
    private function shapeJob(array $job): array
    {
        return [
            'id' => $job['publicId'] ?? null,
            'status' => $job['status'] ?? 'unknown',
            'sourceDomain' => $job['sourceDomain'] ?? null,
            'adapterName' => $job['adapterName'] ?? 'generic',
            'inputUrl' => $job['inputUrl'] ?? null,
            'normalizedUrl' => $job['normalizedUrl'] ?? null,
            'product' => $job['product'] ?? null,
            'startedAt' => $job['startedAt'] ?? null,
            'finishedAt' => $job['finishedAt'] ?? null,
            'error' => isset($job['errorCode']) && $job['errorCode'] !== null
                ? [
                    'code' => $job['errorCode'],
                    'message' => $job['errorMessage'] ?? null,
                ]
                : null,
        ];
    }

    private function error(string $code, string $message, int $status): Response
    {
        return Response::json([
            'ok' => false,
            'error' => ['code' => $code, 'message' => $message],
            'meta' => $this->meta(),
        ], $status);
    }

    /**
     * @param array<string, mixed> $data
     */
    private function success(array $data): Response
    {
        return Response::json([
            'ok' => true,
            'data' => $data,
            'meta' => $this->meta(),
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function meta(): array
    {
        return [
            'requestId' => 'req_' . bin2hex(random_bytes(8)),
            'serverTime' => date(DATE_ATOM),
        ];
    }

    private function limit(?string $value): int
    {
        $limit = $this->positiveIntOrNull($value) ?? 20;

        return min($limit, 50);
    }

    private function positiveIntOrNull(?string $value): ?int
    {
        if ($value === null || $value === '' || !ctype_digit($value)) {
            return null;
        }

        $intValue = (int) $value;

        return $intValue > 0 ? $intValue : null;
    }
}
