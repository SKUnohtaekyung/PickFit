<?php

declare(strict_types=1);

namespace PickFit\Repositories;

use PDO;
use PickFit\Support\JsonColumn;
use PickFit\Support\PublicId;

final class RecommendationRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param array<string, mixed> $conditions
     * @param array<int, string> $candidateProductPublicIds
     * @param array<int, array<string, mixed>> $outfits
     * @param array<string, int>|null $modelUsage Token usage from the model response, if any
     * @return array{publicId: string, outfits: array<int, array<string, mixed>>}
     */
    public function persistRun(
        int $userId,
        array $conditions,
        array $candidateProductPublicIds,
        array $outfits,
        ?float $confidence,
        ?string $modelName = null,
        ?string $modelResponseId = null,
        ?array $modelUsage = null,
    ): array
    {
        $this->pdo->beginTransaction();

        try {
            $runPublicId = PublicId::generate();
            $runStatement = $this->pdo->prepare(
                'INSERT INTO recommendation_runs
                    (public_id, user_id, status, input_conditions_json, candidate_product_ids_json,
                     model_name, model_response_id, model_usage_json, confidence)
                 VALUES (:publicId, :userId, :status, :conditions, :candidates,
                         :modelName, :modelResponseId, :modelUsage, :confidence)',
            );
            $runStatement->execute([
                'publicId' => $runPublicId,
                'userId' => $userId,
                'status' => 'succeeded',
                'conditions' => json_encode($conditions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'candidates' => json_encode($candidateProductPublicIds, JSON_UNESCAPED_SLASHES),
                'modelName' => $modelName,
                'modelResponseId' => $modelResponseId,
                'modelUsage' => $modelUsage === null
                    ? null
                    : json_encode($modelUsage, JSON_UNESCAPED_SLASHES),
                'confidence' => $confidence,
            ]);

            $runId = (int) $this->pdo->lastInsertId();
            $savedOutfits = [];

            foreach ($outfits as $index => $outfit) {
                $outfitPublicId = PublicId::generate();
                $outfitStatement = $this->pdo->prepare(
                    'INSERT INTO recommendation_outfits
                        (public_id, run_id, title, framing_label, summary, reason_text, reasons_json,
                         evidence_json, risk_notes_json, review_evidence,
                         total_price, sort_order, confidence)
                     VALUES (:publicId, :runId, :title, :framingLabel, :summary, :reason, :reasonsJson,
                             :evidence, :risks, :reviewEvidence,
                             :totalPrice, :sortOrder, :confidence)',
                );
                $outfitStatement->execute([
                    'publicId' => $outfitPublicId,
                    'runId' => $runId,
                    'title' => (string) ($outfit['title'] ?? ''),
                    'framingLabel' => isset($outfit['framingLabel']) ? (string) $outfit['framingLabel'] : null,
                    'summary' => (string) ($outfit['summary'] ?? ''),
                    'reason' => isset($outfit['reasonText']) ? (string) $outfit['reasonText'] : null,
                    'reasonsJson' => json_encode($outfit['reasons'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'evidence' => json_encode($outfit['evidence'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'risks' => json_encode($outfit['risks'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'reviewEvidence' => isset($outfit['reviewEvidence']) ? (string) $outfit['reviewEvidence'] : null,
                    'totalPrice' => isset($outfit['totalPrice']) ? (int) $outfit['totalPrice'] : null,
                    'sortOrder' => $index,
                    'confidence' => isset($outfit['confidence']) ? (float) $outfit['confidence'] : null,
                ]);
                $outfitId = (int) $this->pdo->lastInsertId();

                foreach ($outfit['items'] ?? [] as $item) {
                    $productInternalId = isset($item['productInternalId']) ? (int) $item['productInternalId'] : 0;
                    if ($productInternalId <= 0) {
                        continue;
                    }
                    $itemStatement = $this->pdo->prepare(
                        'INSERT INTO recommendation_items
                            (outfit_id, product_id, slot, alternative_product_ids_json, reason)
                         VALUES (:outfitId, :productId, :slot, :alternatives, :reason)',
                    );
                    $itemStatement->execute([
                        'outfitId' => $outfitId,
                        'productId' => $productInternalId,
                        'slot' => (string) ($item['slot'] ?? 'top'),
                        'alternatives' => json_encode($item['alternativeProductIds'] ?? [], JSON_UNESCAPED_SLASHES),
                        'reason' => isset($item['reason']) ? (string) $item['reason'] : null,
                    ]);
                }

                $savedOutfits[] = array_merge($outfit, ['publicId' => $outfitPublicId]);
            }

            $this->pdo->commit();

            return [
                'publicId' => $runPublicId,
                'outfits' => $savedOutfits,
            ];
        } catch (\Throwable $exception) {
            try {
                if ($this->pdo->inTransaction()) {
                    $this->pdo->rollBack();
                }
            } catch (\Throwable) {
                // swallow secondary failure so original exception is what callers see
            }
            throw $exception;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findRun(string $publicId, int $userId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, public_id, user_id, status, input_conditions_json, candidate_product_ids_json,
                    model_name, model_response_id, model_usage_json,
                    confidence, created_at, updated_at
             FROM recommendation_runs WHERE public_id = :publicId AND user_id = :userId LIMIT 1',
        );
        $statement->execute(['publicId' => $publicId, 'userId' => $userId]);
        $row = $statement->fetch();

        if (!is_array($row)) {
            return null;
        }

        return [
            'id' => (int) $row['id'],
            'publicId' => (string) $row['public_id'],
            'userId' => (int) $row['user_id'],
            'status' => (string) $row['status'],
            'inputConditions' => JsonColumn::decode($row['input_conditions_json']),
            'candidateProductIds' => JsonColumn::decode($row['candidate_product_ids_json']),
            'modelName' => $row['model_name'] === null ? null : (string) $row['model_name'],
            'modelResponseId' => $row['model_response_id'] === null ? null : (string) $row['model_response_id'],
            'modelUsage' => JsonColumn::decode($row['model_usage_json']),
            'confidence' => $row['confidence'] === null ? null : (float) $row['confidence'],
            'createdAt' => (string) $row['created_at'],
            'updatedAt' => (string) $row['updated_at'],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listOutfitsForRun(int $runId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, public_id, title, framing_label, summary, reason_text, reasons_json,
                    evidence_json, risk_notes_json, review_evidence,
                    total_price, sort_order, confidence
             FROM recommendation_outfits WHERE run_id = :runId ORDER BY sort_order ASC, id ASC',
        );
        $statement->execute(['runId' => $runId]);
        $rows = $statement->fetchAll();

        return array_map(fn (array $row): array => [
            'id' => (int) $row['id'],
            'publicId' => (string) $row['public_id'],
            'title' => (string) $row['title'],
            'framingLabel' => $row['framing_label'] === null ? null : (string) $row['framing_label'],
            'summary' => (string) $row['summary'],
            'reasonText' => $row['reason_text'] === null ? null : (string) $row['reason_text'],
            'reasons' => JsonColumn::decode($row['reasons_json']),
            'evidence' => JsonColumn::decode($row['evidence_json']),
            'risks' => JsonColumn::decode($row['risk_notes_json']),
            'reviewEvidence' => $row['review_evidence'] === null ? null : (string) $row['review_evidence'],
            'totalPrice' => $row['total_price'] === null ? null : (int) $row['total_price'],
            'sortOrder' => (int) $row['sort_order'],
            'confidence' => $row['confidence'] === null ? null : (float) $row['confidence'],
        ], $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listItemsForOutfits(array $outfitInternalIds): array
    {
        if (empty($outfitInternalIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($outfitInternalIds), '?'));
        $sql = "SELECT ri.outfit_id, ri.slot, ri.alternative_product_ids_json, ri.reason,
                       p.public_id AS product_public_id, p.brand_name, p.product_name,
                       p.price_sale, p.price_original, p.discount_rate, p.hero_image_url,
                       p.product_page_url, p.fit_type, p.seasonality, p.color_family,
                       p.category_main, p.category_sub, p.material_main,
                       (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id) AS review_rating,
                       (SELECT r.review_text FROM reviews r WHERE r.product_id = p.id ORDER BY r.id ASC LIMIT 1) AS review_highlight,
                       (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count,
                       (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.size_runs = 'small') AS size_runs_small,
                       (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.size_runs = 'large') AS size_runs_large
                FROM recommendation_items ri
                INNER JOIN products p ON p.id = ri.product_id
                WHERE ri.outfit_id IN ($placeholders)
                ORDER BY ri.id ASC";
        $statement = $this->pdo->prepare($sql);
        $statement->execute($outfitInternalIds);
        $rows = $statement->fetchAll();

        return array_map(fn (array $row): array => [
            'outfitId' => (int) $row['outfit_id'],
            'slot' => (string) $row['slot'],
            'productPublicId' => (string) $row['product_public_id'],
            'product' => [
                'id' => (string) $row['product_public_id'],
                'publicId' => (string) $row['product_public_id'],
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
                'materialMain' => $row['material_main'] ?? null,
                'reviewHighlight' => $row['review_highlight'] === null ? null : (string) $row['review_highlight'],
                'reviewRating' => $row['review_rating'] === null ? null : (float) $row['review_rating'],
                'reviewCount' => isset($row['review_count']) ? (int) $row['review_count'] : 0,
                'fitRisk' => $this->fitRiskBand(
                    isset($row['review_count']) ? (int) $row['review_count'] : 0,
                    isset($row['size_runs_small']) ? (int) $row['size_runs_small'] : 0,
                    isset($row['size_runs_large']) ? (int) $row['size_runs_large'] : 0,
                ),
            ],
            'alternativeProductIds' => JsonColumn::decode($row['alternative_product_ids_json']),
            'reason' => $row['reason'] === null ? null : (string) $row['reason'],
        ], $rows);
    }

    /**
     * Review-grounded per-product fit risk, mirroring
     * ProductRepository::computeFitRisk so saved/re-fetched outfits show the same
     * comparison value as a fresh run.
     */
    private function fitRiskBand(int $reviewCount, int $smallCount, int $largeCount): string
    {
        if ($reviewCount < 2) {
            return '정보부족';
        }
        $ratio = ($smallCount + $largeCount) / $reviewCount;
        if ($ratio >= 0.5) {
            return '높음';
        }
        if ($ratio >= 0.2) {
            return '중간';
        }
        return '낮음';
    }
}
