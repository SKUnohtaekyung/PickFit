<?php

declare(strict_types=1);

namespace PickFit\Tests\Unit\Support;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use PickFit\Support\ResponseValidator;

final class ResponseValidatorTest extends TestCase
{
    private const CANDIDATE_IDS = ['p1', 'p2', 'p3', 'p4'];

    private ResponseValidator $validator;

    protected function setUp(): void
    {
        $this->validator = new ResponseValidator();
    }

    public function testValidatesNormalRecommendationOutput(): void
    {
        $payload = $this->makePayload();
        $result = $this->validator->validateRecommendationOutput($payload, self::CANDIDATE_IDS);

        $this->assertTrue($result['ok']);
        $this->assertArrayHasKey('normalizedPayload', $result);
    }

    public function testRejectsWhenOutfitCountIsNotThree(): void
    {
        $payload = $this->makePayload();
        array_pop($payload['outfits']);

        $result = $this->validator->validateRecommendationOutput($payload, self::CANDIDATE_IDS);

        $this->assertFalse($result['ok']);
        $this->assertSame('outfit_count_mismatch', $result['error']);
    }

    public function testRejectsPrimaryProductIdNotInCandidates(): void
    {
        $payload = $this->makePayload();
        $payload['outfits'][0]['productIdsBySlot']['top'] = 'p999';

        $result = $this->validator->validateRecommendationOutput($payload, self::CANDIDATE_IDS);

        $this->assertFalse($result['ok']);
        $this->assertSame('unknown_product_id', $result['error']);
        $this->assertSame('p999', $result['detail']);
    }

    public function testRejectsAlternativeProductIdNotInCandidates(): void
    {
        $payload = $this->makePayload();
        $payload['outfits'][0]['alternativeProductIdsBySlot']['top'] = ['p2', 'p_ghost'];

        $result = $this->validator->validateRecommendationOutput($payload, self::CANDIDATE_IDS);

        $this->assertFalse($result['ok']);
        $this->assertSame('unknown_product_id', $result['error']);
    }

    public function testRejectsDuplicateRank(): void
    {
        $payload = $this->makePayload();
        $payload['outfits'][1]['rank'] = 1;

        $result = $this->validator->validateRecommendationOutput($payload, self::CANDIDATE_IDS);

        $this->assertFalse($result['ok']);
        $this->assertSame('duplicate_rank', $result['error']);
    }

    public function testRejectsConfidenceAboveRange(): void
    {
        $payload = $this->makePayload();
        $payload['confidence'] = 1.5;

        $result = $this->validator->validateRecommendationOutput($payload, self::CANDIDATE_IDS);

        $this->assertFalse($result['ok']);
        $this->assertSame('schema_range_violation', $result['error']);
    }

    public function testRejectsNegativeConfidence(): void
    {
        $payload = $this->makePayload();
        $payload['confidence'] = -0.1;

        $result = $this->validator->validateRecommendationOutput($payload, self::CANDIDATE_IDS);

        $this->assertFalse($result['ok']);
        $this->assertSame('schema_range_violation', $result['error']);
    }

    public function testRejectsMissingTopLevelField(): void
    {
        $payload = $this->makePayload();
        unset($payload['globalWarnings']);

        $result = $this->validator->validateRecommendationOutput($payload, self::CANDIDATE_IDS);

        $this->assertFalse($result['ok']);
        $this->assertSame('schema_missing_field', $result['error']);
        $this->assertSame('globalWarnings', $result['detail']);
    }

    public function testRejectsInvalidFitRiskEnum(): void
    {
        $payload = $this->makePayload();
        $payload['outfits'][0]['comparison']['fitRisk'] = 'medium';

        $result = $this->validator->validateRecommendationOutput($payload, self::CANDIDATE_IDS);

        $this->assertFalse($result['ok']);
        $this->assertSame('schema_enum_violation', $result['error']);
    }

    public function testValidatesProductExtraction(): void
    {
        $payload = $this->extractionPayload();
        $result = $this->validator->validateProductExtraction($payload);

        $this->assertTrue($result['ok']);
    }

    /**
     * @param non-empty-string $field
     */
    #[DataProvider('badEnumProvider')]
    public function testProductExtractionRejectsInvalidEnum(string $field, string $value): void
    {
        $payload = $this->extractionPayload();
        $payload[$field] = $value;

        $result = $this->validator->validateProductExtraction($payload);

        $this->assertFalse($result['ok']);
        $this->assertSame('schema_enum_violation', $result['error']);
        $this->assertSame($field, $result['detail']);
    }

    public static function badEnumProvider(): array
    {
        return [
            'categoryMain'   => ['categoryMain', 'wrong'],
            'currency'       => ['currency', 'XXX'],
            'fitType'        => ['fitType', 'baggy'],
            'thickness'      => ['thickness', 'fluffy'],
            'opacity'        => ['opacity', 'shiny'],
            'stretch'        => ['stretch', 'rubbery'],
        ];
    }

    /**
     * @param non-empty-string $missingKey
     */
    #[DataProvider('missingExtractionFieldProvider')]
    public function testProductExtractionRejectsMissingField(string $missingKey): void
    {
        $payload = $this->extractionPayload();
        unset($payload[$missingKey]);

        $result = $this->validator->validateProductExtraction($payload);

        $this->assertFalse($result['ok']);
        $this->assertSame('schema_missing_field', $result['error']);
        $this->assertSame($missingKey, $result['detail']);
    }

    public static function missingExtractionFieldProvider(): array
    {
        return [
            ['confidence'],
            ['categoryMain'],
            ['styleTags'],
            ['warnings'],
        ];
    }

    public function testProductExtractionRejectsConfidenceOutOfRange(): void
    {
        $payload = $this->extractionPayload();
        $payload['confidence'] = 2.0;

        $result = $this->validator->validateProductExtraction($payload);

        $this->assertFalse($result['ok']);
        $this->assertSame('schema_range_violation', $result['error']);
    }

    /**
     * @return array<string, mixed>
     */
    private function makePayload(): array
    {
        return [
            'confidence' => 0.7,
            'globalWarnings' => [],
            'outfits' => [
                $this->makeOutfit(1, ['top' => 'p1', 'bottom' => 'p2', 'shoes' => 'p3']),
                $this->makeOutfit(2, ['top' => 'p2', 'bottom' => 'p3', 'shoes' => 'p4']),
                $this->makeOutfit(3, ['top' => 'p4', 'bottom' => 'p1', 'shoes' => 'p2']),
            ],
        ];
    }

    /**
     * @param array<string, string> $primaryIds
     * @return array<string, mixed>
     */
    private function makeOutfit(int $rank, array $primaryIds): array
    {
        $primary = ['top' => null, 'bottom' => null, 'outer' => null, 'shoes' => null];
        foreach ($primaryIds as $slot => $id) {
            $primary[$slot] = $id;
        }

        return [
            'rank' => $rank,
            'title' => "Outfit $rank",
            'framingLabel' => '상황 적합도 우선',
            'summary' => 'demo',
            'productIdsBySlot' => $primary,
            'alternativeProductIdsBySlot' => ['top' => [], 'bottom' => [], 'outer' => [], 'shoes' => []],
            'reasons' => ['이유 1', '이유 2'],
            'risks' => [['type' => 'info', 'text' => '데이터 부족']],
            'reviewEvidence' => '리뷰 데이터 부족',
            'comparison' => [
                'price' => '50000원',
                'fit' => '정사이즈',
                'material' => '코튼',
                'season' => '봄/가을',
                'shipping' => '정보 부족',
                'returnFee' => '정보 부족',
                'reviewSummary' => '정보 부족',
                'fitRisk' => '중간',
            ],
            'confidence' => 0.7,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function extractionPayload(): array
    {
        return [
            'productName' => '슬랙스',
            'brandName' => 'PickFit',
            'categoryMain' => 'bottom',
            'categorySub' => '슬랙스',
            'priceSale' => 50000,
            'currency' => 'KRW',
            'fitType' => 'regular',
            'materialMain' => '울',
            'materialSub' => null,
            'thickness' => 'medium',
            'opacity' => 'opaque',
            'stretch' => 'low',
            'colorFamily' => '네이비',
            'seasonality' => ['fall', 'winter'],
            'styleTags' => ['오피스'],
            'occasionTags' => ['출근'],
            'shippingSummary' => null,
            'returnSummary' => null,
            'reviewSummary' => null,
            'riskFlags' => [],
            'confidence' => 0.85,
            'missingFields' => [],
            'warnings' => [],
        ];
    }
}
