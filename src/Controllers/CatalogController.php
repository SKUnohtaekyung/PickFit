<?php

declare(strict_types=1);

namespace PickFit\Controllers;

use PickFit\Http\Request;
use PickFit\Http\Response;
use PickFit\Repositories\ProductRepository;

final class CatalogController
{
    public function __construct(private readonly ProductRepository $products)
    {
    }

    public function index(Request $request): Response
    {
        $limit = $this->limit($request->query('limit'));
        $maxPrice = $this->positiveIntOrNull($request->query('maxPrice'));
        $result = $this->products->list(
            $request->query('category'),
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
