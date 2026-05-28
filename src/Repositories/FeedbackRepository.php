<?php

declare(strict_types=1);

namespace PickFit\Repositories;

use PDO;

final class FeedbackRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array{id: int, runUserId: int}|null
     */
    public function findOutfitOwnership(string $publicId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT o.id, r.user_id AS run_user_id
             FROM recommendation_outfits o
             INNER JOIN recommendation_runs r ON r.id = o.run_id
             WHERE o.public_id = :publicId LIMIT 1',
        );
        $statement->execute(['publicId' => $publicId]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            return null;
        }
        return [
            'id' => (int) $row['id'],
            'runUserId' => (int) $row['run_user_id'],
        ];
    }

    public function findProductInternalIdByPublicId(string $publicId): ?int
    {
        $statement = $this->pdo->prepare(
            'SELECT id FROM products WHERE public_id = :publicId LIMIT 1',
        );
        $statement->execute(['publicId' => $publicId]);
        $value = $statement->fetchColumn();
        return $value === false ? null : (int) $value;
    }

    /**
     * @param array<int, string> $tags
     */
    public function record(
        int $userId,
        ?int $outfitInternalId,
        ?int $productInternalId,
        string $feedbackType,
        array $tags,
        ?string $note,
    ): int
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO feedback_events
                (user_id, outfit_id, product_id, feedback_type, tags_json, note)
             VALUES (:userId, :outfitId, :productId, :feedbackType, :tags, :note)',
        );
        $statement->execute([
            'userId' => $userId,
            'outfitId' => $outfitInternalId,
            'productId' => $productInternalId,
            'feedbackType' => $feedbackType,
            'tags' => json_encode($tags, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'note' => $note,
        ]);
        return (int) $this->pdo->lastInsertId();
    }
}
