<?php

declare(strict_types=1);

namespace PickFit\Repositories;

use PDO;
use PickFit\Support\FitRisk;
use PickFit\Support\JsonColumn;

final class ProductRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, nextCursor: string|null}
     */
    public function list(
        ?string $category,
        ?string $situation,
        ?string $style,
        ?int $maxPrice,
        int $limit,
        ?string $cursor,
    ): array
    {
        // Public catalog browse: only batch-ingested (Musinsa) rows. The 9 seed
        // mock products are excluded everywhere — the live catalog is the real
        // batch ingest. user_url crawls surface through recommendations, not here.
        $conditions = ["stock_status <> :soldOut", "origin_type = 'batch'"];
        $params = ['soldOut' => 'sold_out'];

        if ($category !== null && $category !== '') {
            $conditions[] = 'category_main = :category';
            $params['category'] = $category;
        }

        if ($situation !== null && $situation !== '') {
            $conditions[] = 'JSON_CONTAINS(occasion_tags, :situationJson)';
            $params['situationJson'] = json_encode($situation, JSON_THROW_ON_ERROR);
        }

        if ($style !== null && $style !== '') {
            $conditions[] = 'JSON_CONTAINS(style_tags, :styleJson)';
            $params['styleJson'] = json_encode($style, JSON_THROW_ON_ERROR);
        }

        if ($maxPrice !== null) {
            $conditions[] = 'price_sale <= :maxPrice';
            $params['maxPrice'] = $maxPrice;
        }

        if ($cursor !== null && $cursor !== '') {
            $conditions[] = 'public_id > :cursor';
            $params['cursor'] = $cursor;
        }

        $sql = 'SELECT * FROM products WHERE ' . implode(' AND ', $conditions)
            . ' ORDER BY public_id ASC LIMIT :limit';

        $statement = $this->pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue(':' . $key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $statement->bindValue(':limit', $limit + 1, PDO::PARAM_INT);
        $statement->execute();

        $rows = $statement->fetchAll();
        $nextCursor = null;
        if (count($rows) > $limit) {
            array_pop($rows);
            $last = end($rows);
            $nextCursor = is_array($last) ? (string) $last['public_id'] : null;
        }

        return [
            'items' => array_map([$this, 'toListItem'], $rows),
            'nextCursor' => $nextCursor,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByPublicId(string $publicId): ?array
    {
        $statement = $this->pdo->prepare(
            "SELECT * FROM products
             WHERE public_id = :publicId AND origin_type = 'batch' LIMIT 1",
        );
        $statement->execute(['publicId' => $publicId]);
        $product = $statement->fetch();

        if (!is_array($product)) {
            return null;
        }

        return $this->toDetail($product);
    }

    /**
     * Upsert a product candidate sourced from a Playwright crawl.
     * Matches by `source_url` (TEXT, no index — full scan acceptable while MVP catalog is small).
     * Returns the internal product id for crawl_jobs.product_id linkage.
     *
     * Required keys in $payload: sourceUrl, sourceDomain. Optional: productName, brandName,
     * description, priceCandidates, currencyCandidates, heroImageUrl, imageUrls, screenshotPath,
     * originType ('batch'|'user_url', default 'user_url'), ownerUserId, crawlJobId.
     *
     * Ownership rule: origin_type / owner_user_id are ONLY set on initial INSERT. Re-crawls of
     * the same source_url never change ownership — a later user submitting the same URL cannot
     * take over a row originally seeded or owned by someone else. crawl_job_id is refreshed to
     * the most recent job for traceability.
     *
     * @param array<string, mixed> $payload
     */
    public function upsertFromCrawl(array $payload): int
    {
        $sourceUrl = isset($payload['sourceUrl']) && is_string($payload['sourceUrl']) ? $payload['sourceUrl'] : '';
        if ($sourceUrl === '') {
            throw new \RuntimeException('upsertFromCrawl requires sourceUrl.');
        }
        $sourceDomain = isset($payload['sourceDomain']) && is_string($payload['sourceDomain'])
            ? $payload['sourceDomain']
            : null;

        $productName = isset($payload['productName']) && is_string($payload['productName']) && $payload['productName'] !== ''
            ? mb_substr($this->sanitizeText($payload['productName']), 0, 255)
            : ('미정 상품 · ' . substr(parse_url($sourceUrl, PHP_URL_HOST) ?: 'unknown', 0, 60));
        $brandName = isset($payload['brandName']) && is_string($payload['brandName']) && $payload['brandName'] !== ''
            ? mb_substr($this->sanitizeText($payload['brandName']), 0, 120)
            : null;
        $heroImageUrl = isset($payload['heroImageUrl']) && is_string($payload['heroImageUrl']) && $payload['heroImageUrl'] !== ''
            ? $payload['heroImageUrl']
            : null;
        $priceCandidates = is_array($payload['priceCandidates'] ?? null) ? $payload['priceCandidates'] : [];
        $priceSale = $this->firstPositiveInt($priceCandidates);
        $currencyCandidates = is_array($payload['currencyCandidates'] ?? null) ? $payload['currencyCandidates'] : [];
        $currency = $this->firstString($currencyCandidates) ?: 'KRW';
        if (strlen($currency) !== 3) {
            $currency = 'KRW';
        }
        $qualityScore = $this->scoreCrawlQuality($payload);

        $originType = isset($payload['originType']) && is_string($payload['originType'])
            && in_array($payload['originType'], ['batch', 'user_url'], true)
            ? $payload['originType']
            : 'user_url';
        $ownerUserId = isset($payload['ownerUserId']) && is_int($payload['ownerUserId']) && $payload['ownerUserId'] > 0
            ? $payload['ownerUserId']
            : null;
        $crawlJobId = isset($payload['crawlJobId']) && is_int($payload['crawlJobId']) && $payload['crawlJobId'] > 0
            ? $payload['crawlJobId']
            : null;

        $existing = $this->pdo->prepare('SELECT id FROM products WHERE source_url = :url LIMIT 1');
        $existing->execute(['url' => $sourceUrl]);
        $existingId = $existing->fetchColumn();

        if ($existingId !== false) {
            $update = $this->pdo->prepare(
                'UPDATE products
                 SET source_domain = :sourceDomain,
                     brand_name = COALESCE(:brandName, brand_name),
                     product_name = :productName,
                     hero_image_url = COALESCE(:heroImageUrl, hero_image_url),
                     product_page_url = :productPageUrl,
                     price_sale = COALESCE(:priceSale, price_sale),
                     currency = :currency,
                     crawl_job_id = COALESCE(:crawlJobId, crawl_job_id),
                     data_quality_score = GREATEST(data_quality_score, :qualityScore),
                     last_synced_at = CURRENT_TIMESTAMP
                 WHERE id = :id',
            );
            $update->execute([
                'sourceDomain' => $sourceDomain,
                'brandName' => $brandName,
                'productName' => $productName,
                'heroImageUrl' => $heroImageUrl,
                'productPageUrl' => $sourceUrl,
                'priceSale' => $priceSale,
                'currency' => $currency,
                'crawlJobId' => $crawlJobId,
                'qualityScore' => $qualityScore,
                'id' => (int) $existingId,
            ]);
            $productId = (int) $existingId;
        } else {
            $publicId = \PickFit\Support\PublicId::generate();
            $insert = $this->pdo->prepare(
                'INSERT INTO products
                    (public_id, source_url, source_domain, origin_type, owner_user_id, crawl_job_id,
                     brand_name, category_main, gender_target,
                     product_name, hero_image_url, product_page_url, price_sale, currency, stock_status,
                     data_quality_score, last_synced_at)
                 VALUES
                    (:publicId, :sourceUrl, :sourceDomain, :originType, :ownerUserId, :crawlJobId,
                     :brandName, :categoryMain, :genderTarget,
                     :productName, :heroImageUrl, :productPageUrl, :priceSale, :currency, :stockStatus,
                     :qualityScore, CURRENT_TIMESTAMP)',
            );
            $insert->execute([
                'publicId' => $publicId,
                'sourceUrl' => $sourceUrl,
                'sourceDomain' => $sourceDomain,
                'originType' => $originType,
                'ownerUserId' => $ownerUserId,
                'crawlJobId' => $crawlJobId,
                'brandName' => $brandName,
                'categoryMain' => 'unknown',
                'genderTarget' => null,
                'productName' => $productName,
                'heroImageUrl' => $heroImageUrl,
                'productPageUrl' => $sourceUrl,
                'priceSale' => $priceSale,
                'currency' => $currency,
                'stockStatus' => 'unknown',
                'qualityScore' => $qualityScore,
            ]);
            $productId = (int) $this->pdo->lastInsertId();
        }

        $this->replaceCrawlMedia($productId, $payload);

        return $productId;
    }

    /**
     * Merge OpenAI-normalized extraction onto an existing product row.
     *
     * Only updates fields when the model returned a confident value:
     *  - enum fields skip 'unknown'
     *  - string fields skip null/empty
     *  - array fields skip when empty
     *  - data_quality_score is GREATEST'd with the model's confidence
     *
     * This means a low-confidence OpenAI call cannot overwrite stronger generic-adapter data.
     *
     * @param array<string, mixed> $normalized Validator-normalized product extraction payload
     */
    public function applyOpenAiExtraction(int $productId, array $normalized): void
    {
        $updates = [];
        $params = ['id' => $productId];

        $categoryMain = $normalized['categoryMain'] ?? null;
        if (is_string($categoryMain) && $categoryMain !== '' && $categoryMain !== 'unknown') {
            $updates[] = 'category_main = :categoryMain';
            $params['categoryMain'] = $categoryMain;
        }

        $categorySub = $normalized['categorySub'] ?? null;
        if (is_string($categorySub) && $categorySub !== '') {
            $updates[] = 'category_sub = :categorySub';
            $params['categorySub'] = mb_substr($this->sanitizeText($categorySub), 0, 80);
        }

        $fitType = $normalized['fitType'] ?? null;
        if (is_string($fitType) && $fitType !== '' && $fitType !== 'unknown') {
            $updates[] = 'fit_type = :fitType';
            $params['fitType'] = $fitType;
        }

        $materialMain = $normalized['materialMain'] ?? null;
        if (is_string($materialMain) && $materialMain !== '') {
            $updates[] = 'material_main = :materialMain';
            $params['materialMain'] = mb_substr($this->sanitizeText($materialMain), 0, 120);
        }

        $materialSub = $normalized['materialSub'] ?? null;
        if (is_string($materialSub) && $materialSub !== '') {
            $updates[] = 'material_sub = :materialSub';
            $params['materialSub'] = mb_substr($this->sanitizeText($materialSub), 0, 255);
        }

        foreach (['thickness', 'opacity', 'stretch'] as $key) {
            $value = $normalized[$key] ?? null;
            if (is_string($value) && $value !== '' && $value !== 'unknown') {
                $updates[] = "{$key} = :{$key}";
                $params[$key] = $value;
            }
        }

        $colorFamily = $normalized['colorFamily'] ?? null;
        if (is_string($colorFamily) && $colorFamily !== '') {
            $updates[] = 'color_family = :colorFamily';
            $params['colorFamily'] = mb_substr($this->sanitizeText($colorFamily), 0, 80);
        }

        // products.seasonality is VARCHAR(80) and consumed as a single token
        // by downstream readers — store the first non-empty value rather than
        // a CSV that wouldn't match anywhere.
        $seasonality = $normalized['seasonality'] ?? [];
        if (is_array($seasonality)) {
            $firstSeason = null;
            foreach ($seasonality as $season) {
                if (is_string($season) && $season !== '') {
                    $firstSeason = $season;
                    break;
                }
            }
            if ($firstSeason !== null) {
                $updates[] = 'seasonality = :seasonality';
                $params['seasonality'] = mb_substr($firstSeason, 0, 80);
            }
        }

        foreach ([
            'styleTags' => 'style_tags',
            'occasionTags' => 'occasion_tags',
        ] as $field => $column) {
            $values = $normalized[$field] ?? [];
            if (!is_array($values) || $values === []) {
                continue;
            }
            $clean = [];
            foreach ($values as $tag) {
                if (is_string($tag) && $tag !== '') {
                    $clean[] = $tag;
                }
            }
            if ($clean === []) {
                continue;
            }
            $encoded = json_encode(array_values(array_unique($clean)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encoded === false) {
                continue;
            }
            $updates[] = "{$column} = :{$field}";
            $params[$field] = $encoded;
        }

        $confidence = $normalized['confidence'] ?? null;
        if (is_numeric($confidence) && (float) $confidence > 0) {
            $updates[] = 'data_quality_score = GREATEST(data_quality_score, :qualityScore)';
            $params['qualityScore'] = round((float) $confidence, 3);
        }

        if ($updates === []) {
            return;
        }

        $sql = 'UPDATE products SET ' . implode(', ', $updates) . ' WHERE id = :id';
        $this->pdo->prepare($sql)->execute($params);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function replaceCrawlMedia(int $productId, array $payload): void
    {
        $images = is_array($payload['imageUrls'] ?? null) ? $payload['imageUrls'] : [];
        $screenshotPath = isset($payload['screenshotPath']) && is_string($payload['screenshotPath'])
            ? $payload['screenshotPath']
            : null;

        $this->pdo->prepare('DELETE FROM product_media WHERE product_id = :id')->execute(['id' => $productId]);

        $insert = $this->pdo->prepare(
            'INSERT INTO product_media (product_id, media_type, url, local_path, alt_text, sort_order)
             VALUES (:productId, :mediaType, :url, :localPath, :altText, :sortOrder)',
        );

        $order = 0;
        foreach ($images as $imageUrl) {
            if (!is_string($imageUrl) || $imageUrl === '') {
                continue;
            }
            $insert->execute([
                'productId' => $productId,
                'mediaType' => 'image',
                'url' => $imageUrl,
                'localPath' => null,
                'altText' => null,
                'sortOrder' => $order++,
            ]);
            if ($order >= 8) {
                break;
            }
        }

        if ($screenshotPath !== null) {
            $insert->execute([
                'productId' => $productId,
                'mediaType' => 'screenshot',
                'url' => $screenshotPath,
                'localPath' => $screenshotPath,
                'altText' => null,
                'sortOrder' => 99,
            ]);
        }
    }

    /**
     * @param array<int, mixed> $candidates
     */
    private function firstPositiveInt(array $candidates): ?int
    {
        foreach ($candidates as $value) {
            if (is_numeric($value)) {
                $int = (int) $value;
                if ($int > 0 && $int < 100_000_000) {
                    return $int;
                }
            }
        }
        return null;
    }

    /**
     * @param array<int, mixed> $candidates
     */
    private function firstString(array $candidates): ?string
    {
        foreach ($candidates as $value) {
            if (is_string($value) && $value !== '') {
                return $value;
            }
        }
        return null;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function scoreCrawlQuality(array $payload): float
    {
        $signals = 0;
        $present = 0;
        $checks = [
            'productName' => !empty($payload['productName']) && is_string($payload['productName']),
            'brandName' => !empty($payload['brandName']) && is_string($payload['brandName']),
            'priceCandidates' => is_array($payload['priceCandidates'] ?? null) && !empty($payload['priceCandidates']),
            'heroImageUrl' => !empty($payload['heroImageUrl']) && is_string($payload['heroImageUrl']),
            'description' => !empty($payload['description']) && is_string($payload['description']),
        ];
        foreach ($checks as $met) {
            $signals++;
            if ($met) {
                $present++;
            }
        }
        return $signals === 0 ? 0.0 : round($present / $signals, 3);
    }

    /**
     * Recommendation-specific candidate query.
     *
     * Returns candidates grouped by slot with richer fields than the public catalog list.
     * Public list shape is intentionally not expanded for this; recommendations get their own mapper.
     *
     * @param array<string, mixed> $conditions Normalized onboarding conditions.
     * @param array<int, string> $sourceProductPublicIds Optional product ids to include if available.
     * @return array{top: array<int, array<string, mixed>>, bottom: array<int, array<string, mixed>>, shoes: array<int, array<string, mixed>>, outer: array<int, array<string, mixed>>}
     */
    public function findRecommendationCandidates(
        array $conditions,
        array $sourceProductPublicIds = [],
        ?int $userId = null,
        ?string $userGender = null,
    ): array
    {
        $situation = is_string($conditions['situation'] ?? null) ? $conditions['situation'] : null;
        $mood = is_array($conditions['mood'] ?? null) ? $conditions['mood'] : [];
        $colors = is_array($conditions['colors'] ?? null) ? $conditions['colors'] : [];

        // Recommendation candidates: real batch-ingested (Musinsa) catalog and,
        // when authenticated, the caller's own user_url crawls. The 9 seed mocks
        // are excluded so results stop recycling them. user_url rows owned by other
        // users — or orphaned (owner_user_id IS NULL) — are excluded.
        $ownerClause = $userId === null
            ? "p.origin_type = 'batch'"
            : "(p.origin_type = 'batch' OR (p.origin_type = 'user_url' AND p.owner_user_id = :ownerUserId))";

        // Gender relevance: a 여성 user sees women's + unisex (and ungendered)
        // products, 남성 sees men's + unisex; no/unknown gender → no filter (all).
        $genderClause = ($userGender === 'male' || $userGender === 'female')
            ? " AND (p.gender_target = :userGender OR p.gender_target = 'unisex' OR p.gender_target IS NULL)"
            : '';

        $sql = 'SELECT p.id, p.public_id, p.brand_name, p.product_name, p.category_main, p.category_sub,
                       p.price_original, p.price_sale, p.discount_rate, p.hero_image_url, p.product_page_url,
                       p.fit_type, p.silhouette, p.seasonality, p.color_family, p.style_tags, p.occasion_tags,
                       p.body_type_notes, p.stretch, p.thickness, p.opacity, p.stock_status,
                       p.data_quality_score, p.material_main,
                       (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id) AS review_rating,
                       (SELECT r.review_text FROM reviews r WHERE r.product_id = p.id ORDER BY r.id ASC LIMIT 1) AS review_highlight,
                       (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count,
                       (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.size_runs = \'small\') AS size_runs_small,
                       (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.size_runs = \'large\') AS size_runs_large
                FROM products p
                WHERE p.stock_status <> :soldOut
                  AND p.category_main IN (:catTop, :catBottom, :catShoes, :catOuter)
                  AND ' . $ownerClause . $genderClause;

        $params = [
            'soldOut' => 'sold_out',
            'catTop' => 'top',
            'catBottom' => 'bottom',
            'catShoes' => 'shoes',
            'catOuter' => 'outer',
        ];
        if ($userId !== null) {
            $params['ownerUserId'] = $userId;
        }
        if ($userGender === 'male' || $userGender === 'female') {
            $params['userGender'] = $userGender;
        }

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        $grouped = [
            'top' => [],
            'bottom' => [],
            'shoes' => [],
            'outer' => [],
        ];

        foreach ($statement->fetchAll() as $row) {
            $shaped = $this->toRecommendationCandidate($row);
            $shaped['relevanceScore'] = $this->scoreCandidate($shaped, $situation, $mood, $colors, $sourceProductPublicIds);

            $category = $shaped['categoryMain'] ?? null;
            if (!isset($grouped[$category])) {
                continue;
            }
            $grouped[$category][] = $shaped;
        }

        foreach ($grouped as $slot => &$candidates) {
            usort($candidates, static function (array $a, array $b): int {
                if ($a['relevanceScore'] !== $b['relevanceScore']) {
                    return $b['relevanceScore'] <=> $a['relevanceScore'];
                }
                return ($b['dataQualityScore'] ?? 0) <=> ($a['dataQualityScore'] ?? 0);
            });
        }
        unset($candidates);

        return $grouped;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function toRecommendationCandidate(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'publicId' => (string) $row['public_id'],
            'brandName' => $row['brand_name'],
            'productName' => $row['product_name'],
            'categoryMain' => $row['category_main'],
            'categorySub' => $row['category_sub'],
            'priceOriginal' => $this->nullableInt($row['price_original']),
            'priceSale' => $this->nullableInt($row['price_sale']),
            'discountRate' => $row['discount_rate'] === null ? null : (float) $row['discount_rate'],
            'heroImageUrl' => $row['hero_image_url'],
            'productPageUrl' => $row['product_page_url'],
            'fitType' => $row['fit_type'],
            'silhouette' => $row['silhouette'],
            'seasonality' => $row['seasonality'],
            'colorFamily' => $row['color_family'],
            'styleTags' => JsonColumn::decode($row['style_tags']),
            'occasionTags' => JsonColumn::decode($row['occasion_tags']),
            'bodyTypeNotes' => JsonColumn::decode($row['body_type_notes']),
            'stretch' => $row['stretch'],
            'thickness' => $row['thickness'],
            'opacity' => $row['opacity'],
            'stockStatus' => $row['stock_status'],
            'dataQualityScore' => isset($row['data_quality_score']) ? (float) $row['data_quality_score'] : 0.0,
            'reviewRating' => $row['review_rating'] === null ? null : (float) $row['review_rating'],
            'reviewHighlight' => $row['review_highlight'] === null ? null : (string) $row['review_highlight'],
            'materialMain' => $row['material_main'] ?? null,
            'reviewCount' => isset($row['review_count']) ? (int) $row['review_count'] : 0,
            'fitRisk' => FitRisk::band(
                isset($row['review_count']) ? (int) $row['review_count'] : 0,
                isset($row['size_runs_small']) ? (int) $row['size_runs_small'] : 0,
                isset($row['size_runs_large']) ? (int) $row['size_runs_large'] : 0,
            ),
        ];
    }

    /**
     * @param array<string, mixed> $candidate
     * @param array<int, string> $mood
     * @param array<int, string> $colors
     * @param array<int, string> $sourceProductPublicIds
     */
    private function scoreCandidate(
        array $candidate,
        ?string $situation,
        array $mood,
        array $colors,
        array $sourceProductPublicIds,
    ): int {
        $score = 0;

        if ($situation !== null
            && is_array($candidate['occasionTags'])
            && in_array($situation, $candidate['occasionTags'], true)
        ) {
            $score += 4;
        }

        $styleTags = is_array($candidate['styleTags']) ? $candidate['styleTags'] : [];
        $moodOverlap = array_intersect($mood, $styleTags);
        $score += count($moodOverlap) * 2;

        if (!empty($colors) && in_array($candidate['colorFamily'], $colors, true)) {
            $score += 1;
        }

        if (in_array($candidate['publicId'], $sourceProductPublicIds, true)) {
            $score += 5;
        }

        return $score;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function toListItem(array $row): array
    {
        return [
            'id' => $row['public_id'],
            'brandName' => $row['brand_name'],
            'productName' => $row['product_name'],
            'categoryMain' => $row['category_main'],
            'categorySub' => $row['category_sub'],
            'priceOriginal' => $this->nullableInt($row['price_original']),
            'priceSale' => $this->nullableInt($row['price_sale']),
            'heroImageUrl' => $row['hero_image_url'],
            'fitType' => $row['fit_type'],
            'seasonality' => $row['seasonality'],
            'stockStatus' => $row['stock_status'],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function toDetail(array $row): array
    {
        return array_merge($this->toListItem($row), [
            'sourceDomain' => $row['source_domain'],
            'sellerName' => $row['seller_name'],
            'genderTarget' => $row['gender_target'],
            'productPageUrl' => $row['product_page_url'],
            'discountRate' => $row['discount_rate'] === null ? null : (float) $row['discount_rate'],
            'currency' => $row['currency'],
            'silhouette' => $row['silhouette'],
            'materialMain' => $row['material_main'],
            'materialSub' => $row['material_sub'],
            'thickness' => $row['thickness'],
            'opacity' => $row['opacity'],
            'stretch' => $row['stretch'],
            'colorFamily' => $row['color_family'],
            'styleTags' => JsonColumn::decode($row['style_tags']),
            'occasionTags' => JsonColumn::decode($row['occasion_tags']),
            'bodyTypeNotes' => JsonColumn::decode($row['body_type_notes']),
            'shippingFee' => $this->nullableInt($row['shipping_fee']),
            'freeShippingThreshold' => $this->nullableInt($row['free_shipping_threshold']),
            'estimatedShippingDays' => $row['estimated_shipping_days'],
            'returnable' => $row['returnable'] === null ? null : (bool) $row['returnable'],
            'returnFee' => $this->nullableInt($row['return_fee']),
            'exchangeFee' => $this->nullableInt($row['exchange_fee']),
            'policyNote' => $row['policy_note'],
            'dataQualityScore' => (float) $row['data_quality_score'],
            'variants' => $this->variants((int) $row['id']),
            'media' => $this->media((int) $row['id']),
            'reviews' => $this->reviews((int) $row['id']),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function variants(int $productId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT public_id, color_name, color_code_normalized, size_label, size_system, stock_status, variant_url, variant_image_url
             FROM product_variants WHERE product_id = :productId ORDER BY id ASC',
        );
        $statement->execute(['productId' => $productId]);

        return array_map(static fn (array $row): array => [
            'id' => $row['public_id'],
            'colorName' => $row['color_name'],
            'colorCodeNormalized' => $row['color_code_normalized'],
            'sizeLabel' => $row['size_label'],
            'sizeSystem' => $row['size_system'],
            'stockStatus' => $row['stock_status'],
            'variantUrl' => $row['variant_url'],
            'variantImageUrl' => $row['variant_image_url'],
        ], $statement->fetchAll());
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function media(int $productId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT media_type, url, local_path, alt_text, sort_order
             FROM product_media WHERE product_id = :productId ORDER BY sort_order ASC, id ASC',
        );
        $statement->execute(['productId' => $productId]);

        return array_map(static fn (array $row): array => [
            'type' => $row['media_type'],
            'url' => $row['url'],
            'localPath' => $row['local_path'],
            'altText' => $row['alt_text'],
            'sortOrder' => (int) $row['sort_order'],
        ], $statement->fetchAll());
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function reviews(int $productId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT public_id, rating, review_text, verified_purchase, size_runs, fit_satisfaction, material_satisfaction, complaint_tags, praise_tags
             FROM reviews WHERE product_id = :productId ORDER BY id ASC',
        );
        $statement->execute(['productId' => $productId]);

        return array_map(fn (array $row): array => [
            'id' => $row['public_id'],
            'rating' => $row['rating'] === null ? null : (float) $row['rating'],
            'reviewText' => $row['review_text'],
            'verifiedPurchase' => $row['verified_purchase'] === null ? null : (bool) $row['verified_purchase'],
            'sizeRuns' => $row['size_runs'],
            'fitSatisfaction' => $row['fit_satisfaction'],
            'materialSatisfaction' => $row['material_satisfaction'],
            'complaintTags' => JsonColumn::decode($row['complaint_tags']),
            'praiseTags' => JsonColumn::decode($row['praise_tags']),
        ], $statement->fetchAll());
    }

    private function nullableInt(mixed $value): ?int
    {
        return $value === null ? null : (int) $value;
    }

    /**
     * Strip HTML tags, collapse whitespace, and drop control characters from
     * untrusted text before it lands in `products.*` columns. Defense-in-depth
     * against stored XSS originating from crawled DOM text or OpenAI output —
     * the render layer must still escape, but storage stays clean either way.
     */
    private function sanitizeText(string $value): string
    {
        $stripped = strip_tags($value);
        // Drop control characters (except tab/newline/CR which we collapse below).
        $stripped = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $stripped) ?? $stripped;
        // Collapse runs of whitespace to a single space.
        $stripped = preg_replace('/\s+/u', ' ', $stripped) ?? $stripped;
        return trim($stripped);
    }
}
