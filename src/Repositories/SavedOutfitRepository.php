<?php

declare(strict_types=1);

namespace PickFit\Repositories;

use PDO;
use PDOException;
use PickFit\Support\JsonColumn;

final class SavedOutfitRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array<string, mixed>|null Internal+public IDs and run linkage.
     */
    public function findOutfitByPublicId(string $publicId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT o.id, o.public_id, o.run_id, o.title, o.summary, o.framing_label, o.total_price,
                    o.reason_text, o.evidence_json, o.risk_notes_json, o.confidence, o.sort_order,
                    r.user_id AS run_user_id
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
            'publicId' => (string) $row['public_id'],
            'runId' => (int) $row['run_id'],
            'runUserId' => (int) $row['run_user_id'],
            'title' => (string) $row['title'],
            'summary' => $row['summary'] === null ? null : (string) $row['summary'],
            'framingLabel' => $row['framing_label'] === null ? null : (string) $row['framing_label'],
            'totalPrice' => $row['total_price'] === null ? null : (int) $row['total_price'],
            'reasonText' => $row['reason_text'] === null ? null : (string) $row['reason_text'],
            'evidence' => JsonColumn::decode($row['evidence_json']),
            'risks' => JsonColumn::decode($row['risk_notes_json']),
            'confidence' => $row['confidence'] === null ? null : (float) $row['confidence'],
            'sortOrder' => (int) $row['sort_order'],
        ];
    }

    /**
     * @return array{savedOutfitId: int, savedAt: string}
     */
    public function save(int $userId, int $outfitInternalId): array
    {
        try {
            $statement = $this->pdo->prepare(
                'INSERT INTO saved_outfits (user_id, outfit_id) VALUES (:userId, :outfitId)',
            );
            $statement->execute([
                'userId' => $userId,
                'outfitId' => $outfitInternalId,
            ]);
        } catch (PDOException $exception) {
            if ($exception->getCode() !== '23000') {
                throw $exception;
            }
        }

        $existing = $this->pdo->prepare(
            'SELECT id, created_at FROM saved_outfits WHERE user_id = :userId AND outfit_id = :outfitId LIMIT 1',
        );
        $existing->execute(['userId' => $userId, 'outfitId' => $outfitInternalId]);
        $row = $existing->fetch();

        if (!is_array($row)) {
            throw new PDOException('Saved outfit row could not be resolved after insert attempt.');
        }

        return [
            'savedOutfitId' => (int) $row['id'],
            'savedAt' => (string) $row['created_at'],
        ];
    }

    public function deleteByOutfitPublicId(int $userId, string $outfitPublicId): bool
    {
        $statement = $this->pdo->prepare(
            'DELETE so FROM saved_outfits so
             INNER JOIN recommendation_outfits o ON o.id = so.outfit_id
             WHERE so.user_id = :userId AND o.public_id = :publicId',
        );
        $statement->execute([
            'userId' => $userId,
            'publicId' => $outfitPublicId,
        ]);
        return $statement->rowCount() > 0;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listForUser(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT so.id AS saved_id, so.created_at AS saved_at,
                    o.id AS outfit_internal_id, o.public_id AS outfit_public_id, o.title, o.summary,
                    o.framing_label, o.total_price, o.reason_text, o.evidence_json, o.risk_notes_json,
                    o.confidence, o.sort_order, o.run_id
             FROM saved_outfits so
             INNER JOIN recommendation_outfits o ON o.id = so.outfit_id
             WHERE so.user_id = :userId
             ORDER BY so.created_at DESC, so.id DESC',
        );
        $statement->execute(['userId' => $userId]);

        return array_map(fn (array $row): array => [
            'savedOutfitId' => (int) $row['saved_id'],
            'savedAt' => (string) $row['saved_at'],
            'outfit' => [
                'id' => (int) $row['outfit_internal_id'],
                'publicId' => (string) $row['outfit_public_id'],
                'runId' => (int) $row['run_id'],
                'title' => (string) $row['title'],
                'summary' => $row['summary'] === null ? null : (string) $row['summary'],
                'framingLabel' => $row['framing_label'] === null ? null : (string) $row['framing_label'],
                'totalPrice' => $row['total_price'] === null ? null : (int) $row['total_price'],
                'reasonText' => $row['reason_text'] === null ? null : (string) $row['reason_text'],
                'evidence' => JsonColumn::decode($row['evidence_json']),
                'risks' => JsonColumn::decode($row['risk_notes_json']),
                'confidence' => $row['confidence'] === null ? null : (float) $row['confidence'],
                'sortOrder' => (int) $row['sort_order'],
            ],
        ], $statement->fetchAll());
    }

    /**
     * @param array<int, int> $outfitInternalIds
     * @return array<int, array<int, array<string, mixed>>> Keyed by outfit internal id
     */
    public function itemsForOutfits(array $outfitInternalIds): array
    {
        if (empty($outfitInternalIds)) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($outfitInternalIds), '?'));
        $sql = "SELECT ri.outfit_id, ri.slot, ri.alternative_product_ids_json, ri.reason,
                       p.public_id AS product_public_id, p.brand_name, p.product_name,
                       p.price_sale, p.price_original, p.discount_rate, p.hero_image_url,
                       p.product_page_url, p.fit_type, p.seasonality, p.color_family,
                       p.category_main, p.category_sub
                FROM recommendation_items ri
                INNER JOIN products p ON p.id = ri.product_id
                WHERE ri.outfit_id IN ($placeholders)
                ORDER BY ri.id ASC";
        $statement = $this->pdo->prepare($sql);
        $statement->execute($outfitInternalIds);
        $rows = $statement->fetchAll();

        $byOutfit = [];
        foreach ($rows as $row) {
            $byOutfit[(int) $row['outfit_id']][] = [
                'slot' => (string) $row['slot'],
                'productPublicId' => (string) $row['product_public_id'],
                'product' => [
                    'id' => (string) $row['product_public_id'],
                    'brandName' => (string) $row['brand_name'],
                    'productName' => (string) $row['product_name'],
                    'priceSale' => $row['price_sale'] === null ? null : (int) $row['price_sale'],
                    'priceOriginal' => $row['price_original'] === null ? null : (int) $row['price_original'],
                    'discountRate' => $row['discount_rate'] === null ? null : (float) $row['discount_rate'],
                    'heroImageUrl' => $row['hero_image_url'],
                    'productPageUrl' => $row['product_page_url'],
                    'fitType' => $row['fit_type'],
                    'seasonality' => $row['seasonality'],
                    'colorFamily' => $row['color_family'],
                    'categoryMain' => $row['category_main'],
                    'categorySub' => $row['category_sub'],
                ],
                'alternativeProductIds' => JsonColumn::decode($row['alternative_product_ids_json']),
                'reason' => $row['reason'] === null ? null : (string) $row['reason'],
            ];
        }
        return $byOutfit;
    }

}
