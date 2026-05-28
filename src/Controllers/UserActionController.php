<?php

declare(strict_types=1);

namespace PickFit\Controllers;

use InvalidArgumentException;
use PickFit\Http\Request;
use PickFit\Http\Response;
use PickFit\Repositories\FeedbackRepository;
use PickFit\Repositories\SavedOutfitRepository;

final class UserActionController
{
    private const ALLOWED_FEEDBACK_TYPES = [
        'liked',
        'not_my_taste',
        'too_expensive',
        'too_basic',
        'too_flashy',
        'too_slim',
        'show_more',
        'not_flattering',
        'general',
    ];

    public function __construct(
        private readonly SavedOutfitRepository $savedOutfits,
        private readonly FeedbackRepository $feedback,
    ) {
    }

    /**
     * @param array<string, mixed> $sessionUser
     */
    public function listSaved(array $sessionUser): Response
    {
        $userId = (int) $sessionUser['userId'];
        $saved = $this->savedOutfits->listForUser($userId);
        $outfitIds = array_map(static fn (array $entry): int => (int) $entry['outfit']['id'], $saved);
        $itemsByOutfit = $this->savedOutfits->itemsForOutfits($outfitIds);

        $shaped = array_map(function (array $entry) use ($itemsByOutfit): array {
            $internalId = (int) $entry['outfit']['id'];
            $outfitItems = $itemsByOutfit[$internalId] ?? [];
            return [
                'savedOutfitId' => $entry['savedOutfitId'],
                'savedAt' => $entry['savedAt'],
                'outfit' => array_merge(
                    $entry['outfit'],
                    ['items' => $outfitItems],
                ),
            ];
        }, $saved);

        return $this->success(['savedOutfits' => $shaped]);
    }

    /**
     * @param array<string, mixed> $sessionUser
     */
    public function save(Request $request, array $sessionUser): Response
    {
        $data = $this->json($request);
        if ($data instanceof Response) {
            return $data;
        }

        $outfitPublicId = $this->stringValue($data, 'outfitId');
        if ($outfitPublicId instanceof Response) {
            return $outfitPublicId;
        }

        $outfit = $this->savedOutfits->findOutfitByPublicId($outfitPublicId);
        if ($outfit === null) {
            return $this->error('not_found', 'Outfit not found.', 404);
        }

        if ((int) $outfit['runUserId'] !== (int) $sessionUser['userId']) {
            return $this->error('forbidden', 'Outfit belongs to another user.', 403);
        }

        $result = $this->savedOutfits->save((int) $sessionUser['userId'], (int) $outfit['id']);

        return $this->success([
            'savedOutfit' => [
                'savedOutfitId' => $result['savedOutfitId'],
                'outfitId' => $outfitPublicId,
                'savedAt' => $result['savedAt'],
            ],
        ], 201);
    }

    /**
     * @param array<string, mixed> $sessionUser
     */
    public function deleteSaved(string $outfitPublicId, array $sessionUser): Response
    {
        $deleted = $this->savedOutfits->deleteByOutfitPublicId(
            (int) $sessionUser['userId'],
            $outfitPublicId,
        );
        if (!$deleted) {
            return $this->error('not_found', 'Saved outfit not found.', 404);
        }
        return $this->success(['deleted' => true]);
    }

    /**
     * @param array<string, mixed> $sessionUser
     */
    public function submitFeedback(Request $request, array $sessionUser): Response
    {
        $data = $this->json($request);
        if ($data instanceof Response) {
            return $data;
        }

        $feedbackType = $this->normalizeFeedbackType($data);
        if ($feedbackType instanceof Response) {
            return $feedbackType;
        }

        $tags = $this->normalizeTags($data);
        if ($tags instanceof Response) {
            return $tags;
        }

        $note = $this->normalizeNote($data);
        if ($note instanceof Response) {
            return $note;
        }

        $outfitPublicId = isset($data['outfitId']) && is_string($data['outfitId']) && $data['outfitId'] !== ''
            ? $data['outfitId']
            : null;
        $productPublicId = isset($data['productId']) && is_string($data['productId']) && $data['productId'] !== ''
            ? $data['productId']
            : null;

        $outfitInternalId = null;
        if ($outfitPublicId !== null) {
            $ownership = $this->feedback->findOutfitOwnership($outfitPublicId);
            if ($ownership === null) {
                return $this->error('not_found', 'Referenced outfit not found.', 404);
            }
            if ($ownership['runUserId'] !== (int) $sessionUser['userId']) {
                return $this->error('forbidden', 'Outfit belongs to another user.', 403);
            }
            $outfitInternalId = $ownership['id'];
        }

        $productInternalId = null;
        if ($productPublicId !== null) {
            $productInternalId = $this->feedback->findProductInternalIdByPublicId($productPublicId);
            if ($productInternalId === null) {
                return $this->error('not_found', 'Referenced product not found.', 404);
            }
        }

        $id = $this->feedback->record(
            (int) $sessionUser['userId'],
            $outfitInternalId,
            $productInternalId,
            $feedbackType,
            $tags,
            $note,
        );

        return $this->success([
            'feedback' => [
                'id' => $id,
                'feedbackType' => $feedbackType,
                'tags' => $tags,
                'outfitId' => $outfitPublicId,
                'productId' => $productPublicId,
            ],
        ], 201);
    }

    /**
     * @return array<string, mixed>|Response
     */
    private function json(Request $request): array|Response
    {
        try {
            return $request->json();
        } catch (InvalidArgumentException) {
            return $this->error('validation_failed', 'Request body must be a JSON object.', 422);
        }
    }

    /**
     * @param array<string, mixed> $data
     */
    private function stringValue(array $data, string $key): string|Response
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || $value === '') {
            return $this->error('validation_failed', $key . ' is required.', 422);
        }
        return $value;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function normalizeFeedbackType(array $data): string|Response
    {
        $value = $data['feedbackType'] ?? null;
        if (!is_string($value) || $value === '') {
            return $this->error('validation_failed', 'feedbackType is required.', 422);
        }
        if (!in_array($value, self::ALLOWED_FEEDBACK_TYPES, true)) {
            return $this->error('validation_failed', 'feedbackType is not allowed.', 422);
        }
        return $value;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<int, string>|Response
     */
    private function normalizeTags(array $data): array|Response
    {
        $raw = $data['tags'] ?? [];
        if (!is_array($raw)) {
            return $this->error('validation_failed', 'tags must be an array of strings.', 422);
        }
        $tags = [];
        foreach ($raw as $value) {
            if (!is_string($value)) {
                return $this->error('validation_failed', 'tags must be an array of strings.', 422);
            }
            $trimmed = trim($value);
            if ($trimmed === '') {
                continue;
            }
            if (strlen($trimmed) > 60) {
                return $this->error('validation_failed', 'tags must be 60 characters or fewer.', 422);
            }
            $tags[] = $trimmed;
        }
        if (count($tags) > 8) {
            return $this->error('validation_failed', 'tags may contain at most 8 entries.', 422);
        }
        return array_values(array_unique($tags));
    }

    /**
     * @param array<string, mixed> $data
     */
    private function normalizeNote(array $data): string|null|Response
    {
        $value = $data['note'] ?? null;
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_string($value)) {
            return $this->error('validation_failed', 'note must be a string.', 422);
        }
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }
        if (strlen($trimmed) > 500) {
            return $this->error('validation_failed', 'note must be 500 characters or fewer.', 422);
        }
        return $trimmed;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function success(array $data, int $status = 200): Response
    {
        return Response::json([
            'ok' => true,
            'data' => $data,
            'meta' => $this->meta(),
        ], $status);
    }

    private function error(string $code, string $message, int $status): Response
    {
        return Response::json([
            'ok' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
            'meta' => $this->meta(),
        ], $status);
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
}
