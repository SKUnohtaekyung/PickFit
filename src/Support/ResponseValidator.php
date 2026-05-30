<?php

declare(strict_types=1);

namespace PickFit\Support;

/**
 * Server-side re-validation for OpenAI Structured Outputs.
 *
 * OpenAI's strict mode validates the schema on its end, but we re-check on the
 * server because the model can still:
 *   - return product IDs outside the candidate whitelist (hallucination)
 *   - violate runtime constraints that strict mode does not enforce (0~1 ranges,
 *     exact outfit count, unique ranks)
 *   - drift its schema across model versions
 *
 * Pure value object — no DB, no FS, no HTTP. Easy to unit test in isolation.
 */
final class ResponseValidator
{
    private const CATEGORY_MAIN = ['top', 'bottom', 'outer', 'shoes', 'accessory', 'unknown'];
    private const CURRENCY = ['KRW', 'USD', 'JPY', 'EUR', 'UNKNOWN'];
    private const FIT_TYPE = ['slim', 'regular', 'oversized', 'relaxed', 'straight', 'wide', 'unknown'];
    private const THICKNESS = ['light', 'medium', 'heavy', 'unknown'];
    private const OPACITY = ['sheer', 'semi', 'opaque', 'unknown'];
    private const STRETCH = ['none', 'low', 'medium', 'high', 'unknown'];
    private const SEASONALITY = ['spring', 'summer', 'fall', 'winter'];
    private const RISK_TYPE = ['info', 'warning', 'low_confidence'];
    private const FIT_RISK = ['낮음', '중간', '높음', '정보부족'];
    private const SLOTS = ['top', 'bottom', 'outer', 'shoes'];
    private const OUTFIT_COUNT = 3;

    private const NULLABLE_STRING_FIELDS = [
        'productName',
        'brandName',
        'categorySub',
        'materialMain',
        'materialSub',
        'colorFamily',
        'shippingSummary',
        'returnSummary',
        'reviewSummary',
    ];

    private const STRING_ARRAY_FIELDS = [
        'styleTags',
        'occasionTags',
        'riskFlags',
        'missingFields',
        'warnings',
    ];

    private const EXTRACTION_REQUIRED = [
        'productName', 'brandName', 'categoryMain', 'categorySub', 'priceSale',
        'currency', 'fitType', 'materialMain', 'materialSub', 'thickness', 'opacity',
        'stretch', 'colorFamily', 'seasonality', 'styleTags', 'occasionTags',
        'shippingSummary', 'returnSummary', 'reviewSummary', 'riskFlags',
        'confidence', 'missingFields', 'warnings',
    ];

    private const OUTFIT_REQUIRED = [
        'rank', 'title', 'framingLabel', 'summary', 'productIdsBySlot',
        'alternativeProductIdsBySlot', 'reasons', 'risks', 'reviewEvidence',
        'comparison', 'confidence',
    ];

    private const COMPARISON_STRING_FIELDS = [
        'price', 'fit', 'material', 'season', 'shipping', 'returnFee', 'reviewSummary',
    ];

    /**
     * @param array<string, mixed> $payload
     * @return array{ok: bool, normalizedPayload?: array<string, mixed>, error?: string, detail?: string}
     */
    public function validateProductExtraction(array $payload): array
    {
        foreach (self::EXTRACTION_REQUIRED as $key) {
            if (!array_key_exists($key, $payload)) {
                return $this->fail('schema_missing_field', $key);
            }
        }

        foreach (self::NULLABLE_STRING_FIELDS as $key) {
            $value = $payload[$key];
            if ($value !== null && !is_string($value)) {
                return $this->fail('schema_type_mismatch', $key);
            }
        }

        $enumChecks = [
            'categoryMain' => self::CATEGORY_MAIN,
            'currency' => self::CURRENCY,
            'fitType' => self::FIT_TYPE,
            'thickness' => self::THICKNESS,
            'opacity' => self::OPACITY,
            'stretch' => self::STRETCH,
        ];
        foreach ($enumChecks as $key => $allowed) {
            $value = $payload[$key];
            if (!is_string($value) || !in_array($value, $allowed, true)) {
                return $this->fail('schema_enum_violation', $key);
            }
        }

        if ($payload['priceSale'] !== null && !is_int($payload['priceSale'])) {
            return $this->fail('schema_type_mismatch', 'priceSale');
        }

        if (!$this->isConfidenceValid($payload['confidence'])) {
            return $this->fail('schema_range_violation', 'confidence');
        }

        foreach (self::STRING_ARRAY_FIELDS as $key) {
            if (!$this->isArrayOfStrings($payload[$key])) {
                return $this->fail('schema_type_mismatch', $key);
            }
        }

        if (!is_array($payload['seasonality'])) {
            return $this->fail('schema_type_mismatch', 'seasonality');
        }
        foreach ($payload['seasonality'] as $season) {
            if (!is_string($season) || !in_array($season, self::SEASONALITY, true)) {
                return $this->fail('schema_enum_violation', 'seasonality');
            }
        }

        return ['ok' => true, 'normalizedPayload' => $payload];
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<int, string> $candidateIds public_id whitelist; only these IDs may appear in slots
     * @return array{ok: bool, normalizedPayload?: array<string, mixed>, error?: string, detail?: string}
     */
    public function validateRecommendationOutput(array $payload, array $candidateIds): array
    {
        foreach (['confidence', 'globalWarnings', 'outfits'] as $key) {
            if (!array_key_exists($key, $payload)) {
                return $this->fail('schema_missing_field', $key);
            }
        }

        if (!$this->isConfidenceValid($payload['confidence'])) {
            return $this->fail('schema_range_violation', 'confidence');
        }

        if (!$this->isArrayOfStrings($payload['globalWarnings'])) {
            return $this->fail('schema_type_mismatch', 'globalWarnings');
        }

        $outfits = $payload['outfits'];
        if (!is_array($outfits) || count($outfits) !== self::OUTFIT_COUNT) {
            return $this->fail('outfit_count_mismatch', 'expected_3');
        }

        $candidateSet = [];
        foreach ($candidateIds as $id) {
            if (is_string($id) && $id !== '') {
                $candidateSet[$id] = true;
            }
        }

        $seenRanks = [];
        foreach ($outfits as $index => $outfit) {
            if (!is_array($outfit)) {
                return $this->fail('schema_type_mismatch', "outfits[$index]");
            }
            $result = $this->validateOutfit($outfit, $candidateSet, (int) $index);
            if (!$result['ok']) {
                return $result;
            }
            $rank = $outfit['rank'];
            if (isset($seenRanks[$rank])) {
                return $this->fail('duplicate_rank', "rank_$rank");
            }
            $seenRanks[$rank] = true;
        }

        return ['ok' => true, 'normalizedPayload' => $payload];
    }

    /**
     * @param array<string, mixed> $outfit
     * @param array<string, true> $candidateSet
     * @return array{ok: bool, error?: string, detail?: string}
     */
    private function validateOutfit(array $outfit, array $candidateSet, int $index): array
    {
        foreach (self::OUTFIT_REQUIRED as $key) {
            if (!array_key_exists($key, $outfit)) {
                return $this->fail('schema_missing_field', "outfits[$index].$key");
            }
        }

        if (!is_int($outfit['rank']) || !in_array($outfit['rank'], [1, 2, 3], true)) {
            return $this->fail('schema_enum_violation', "outfits[$index].rank");
        }

        foreach (['title', 'framingLabel', 'summary', 'reviewEvidence'] as $key) {
            if (!is_string($outfit[$key])) {
                return $this->fail('schema_type_mismatch', "outfits[$index].$key");
            }
        }

        $primary = $outfit['productIdsBySlot'];
        if (!is_array($primary)) {
            return $this->fail('schema_type_mismatch', "outfits[$index].productIdsBySlot");
        }
        $seenPrimary = [];
        foreach (self::SLOTS as $slot) {
            if (!array_key_exists($slot, $primary)) {
                return $this->fail('schema_missing_field', "outfits[$index].productIdsBySlot.$slot");
            }
            $id = $primary[$slot];
            if ($id !== null && !is_string($id)) {
                return $this->fail('schema_type_mismatch', "outfits[$index].productIdsBySlot.$slot");
            }
            if (is_string($id)) {
                if (!isset($candidateSet[$id])) {
                    return $this->fail('unknown_product_id', $id);
                }
                // One product per slot: the same id must not fill two slots of a
                // single outfit (would surface as a duplicate top/bottom in the UI).
                if (isset($seenPrimary[$id])) {
                    return $this->fail('duplicate_product_in_outfit', "outfits[$index].$id");
                }
                $seenPrimary[$id] = true;
            }
        }

        $alternatives = $outfit['alternativeProductIdsBySlot'];
        if (!is_array($alternatives)) {
            return $this->fail('schema_type_mismatch', "outfits[$index].alternativeProductIdsBySlot");
        }
        foreach (self::SLOTS as $slot) {
            if (!array_key_exists($slot, $alternatives)) {
                return $this->fail('schema_missing_field', "outfits[$index].alternativeProductIdsBySlot.$slot");
            }
            $ids = $alternatives[$slot];
            if (!is_array($ids)) {
                return $this->fail('schema_type_mismatch', "outfits[$index].alternativeProductIdsBySlot.$slot");
            }
            foreach ($ids as $id) {
                if (!is_string($id)) {
                    return $this->fail('schema_type_mismatch', "outfits[$index].alternativeProductIdsBySlot.{$slot}[]");
                }
                if (!isset($candidateSet[$id])) {
                    return $this->fail('unknown_product_id', $id);
                }
            }
        }

        if (!$this->isArrayOfStrings($outfit['reasons'])) {
            return $this->fail('schema_type_mismatch', "outfits[$index].reasons");
        }

        if (!is_array($outfit['risks'])) {
            return $this->fail('schema_type_mismatch', "outfits[$index].risks");
        }
        foreach ($outfit['risks'] as $riskIndex => $risk) {
            if (!is_array($risk)) {
                return $this->fail('schema_type_mismatch', "outfits[$index].risks[$riskIndex]");
            }
            $type = $risk['type'] ?? null;
            if (!is_string($type) || !in_array($type, self::RISK_TYPE, true)) {
                return $this->fail('schema_enum_violation', "outfits[$index].risks[$riskIndex].type");
            }
            if (!is_string($risk['text'] ?? null)) {
                return $this->fail('schema_type_mismatch', "outfits[$index].risks[$riskIndex].text");
            }
        }

        $comp = $outfit['comparison'];
        if (!is_array($comp)) {
            return $this->fail('schema_type_mismatch', "outfits[$index].comparison");
        }
        foreach (self::COMPARISON_STRING_FIELDS as $key) {
            if (!is_string($comp[$key] ?? null)) {
                return $this->fail('schema_type_mismatch', "outfits[$index].comparison.$key");
            }
        }
        $fitRisk = $comp['fitRisk'] ?? null;
        if (!is_string($fitRisk) || !in_array($fitRisk, self::FIT_RISK, true)) {
            return $this->fail('schema_enum_violation', "outfits[$index].comparison.fitRisk");
        }

        if (!$this->isConfidenceValid($outfit['confidence'])) {
            return $this->fail('schema_range_violation', "outfits[$index].confidence");
        }

        return ['ok' => true];
    }

    private function isConfidenceValid(mixed $value): bool
    {
        if (!is_int($value) && !is_float($value)) {
            return false;
        }
        $float = (float) $value;
        return $float >= 0.0 && $float <= 1.0;
    }

    private function isArrayOfStrings(mixed $value): bool
    {
        if (!is_array($value)) {
            return false;
        }
        foreach ($value as $item) {
            if (!is_string($item)) {
                return false;
            }
        }
        return true;
    }

    /**
     * @return array{ok: false, error: string, detail: string}
     */
    private function fail(string $error, string $detail): array
    {
        return ['ok' => false, 'error' => $error, 'detail' => $detail];
    }
}
