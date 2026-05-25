<?php

declare(strict_types=1);

namespace PickFit\Repositories;

use PDO;

final class ProductRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, nextCursor: string|null}
     */
    public function list(?string $category, ?int $maxPrice, int $limit, ?string $cursor): array
    {
        $conditions = ['stock_status <> :soldOut'];
        $params = ['soldOut' => 'sold_out'];

        if ($category !== null && $category !== '') {
            $conditions[] = 'category_main = :category';
            $params['category'] = $category;
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
        $statement = $this->pdo->prepare('SELECT * FROM products WHERE public_id = :publicId LIMIT 1');
        $statement->execute(['publicId' => $publicId]);
        $product = $statement->fetch();

        if (!is_array($product)) {
            return null;
        }

        return $this->toDetail($product);
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
            'styleTags' => $this->decodeJsonList($row['style_tags']),
            'occasionTags' => $this->decodeJsonList($row['occasion_tags']),
            'bodyTypeNotes' => $this->decodeJsonList($row['body_type_notes']),
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
            'complaintTags' => $this->decodeJsonList($row['complaint_tags']),
            'praiseTags' => $this->decodeJsonList($row['praise_tags']),
        ], $statement->fetchAll());
    }

    /**
     * @return array<int, mixed>
     */
    private function decodeJsonList(mixed $value): array
    {
        if (!is_string($value) || $value === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function nullableInt(mixed $value): ?int
    {
        return $value === null ? null : (int) $value;
    }
}
