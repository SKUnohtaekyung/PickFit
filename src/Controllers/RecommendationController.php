<?php

declare(strict_types=1);

namespace PickFit\Controllers;

use InvalidArgumentException;
use PickFit\Http\Request;
use PickFit\Http\Response;
use PickFit\Services\RecommendationService;
use PickFit\Support\RespondsWithJson;
use RuntimeException;

final class RecommendationController
{
    use RespondsWithJson;

    public function __construct(private readonly RecommendationService $service)
    {
    }

    /**
     * @param array<string, mixed> $sessionUser
     */
    public function create(Request $request, array $sessionUser): Response
    {
        $payload = $this->json($request);
        if ($payload instanceof Response) {
            return $payload;
        }

        $conditions = $payload['conditions'] ?? null;
        if (!is_array($conditions)) {
            return $this->validationError('conditions must be an object.');
        }

        $sourceProductIds = $payload['sourceProductIds'] ?? [];
        if (!is_array($sourceProductIds)) {
            return $this->validationError('sourceProductIds must be an array of product ids.');
        }
        $normalizedSourceIds = [];
        foreach ($sourceProductIds as $id) {
            if (is_string($id) && $id !== '') {
                $normalizedSourceIds[] = $id;
            }
        }

        try {
            $result = $this->service->generate(
                (int) $sessionUser['userId'],
                $conditions,
                $normalizedSourceIds,
                is_string($sessionUser['gender'] ?? null) ? $sessionUser['gender'] : null,
            );
        } catch (InvalidArgumentException $exception) {
            return $this->validationError($exception->getMessage());
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() === 'low_catalog_coverage') {
                return $this->error('low_catalog_coverage', '추천을 만들 후보 상품이 부족해요. 조건을 조금 풀어 다시 시도해 주세요.', 409);
            }
            return $this->error('recommendation_failed', 'Recommendation could not be generated.', 500);
        }

        return $this->success($result, 201);
    }

    /**
     * @param array<string, mixed> $sessionUser
     */
    public function show(string $runId, array $sessionUser): Response
    {
        $run = $this->service->fetchRun($runId, (int) $sessionUser['userId']);
        if ($run === null) {
            return $this->error('not_found', 'Recommendation run not found.', 404);
        }

        return $this->success($run);
    }

    /**
     * @return array<string, mixed>|Response
     */
    private function json(Request $request): array|Response
    {
        try {
            return $request->json();
        } catch (InvalidArgumentException) {
            return $this->validationError('Request body must be a JSON object.');
        }
    }

    private function validationError(string $message): Response
    {
        return $this->error('validation_failed', $message, 422);
    }
}
