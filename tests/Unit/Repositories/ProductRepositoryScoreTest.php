<?php

declare(strict_types=1);

namespace PickFit\Tests\Unit\Repositories;

use PHPUnit\Framework\TestCase;
use PickFit\Repositories\ProductRepository;
use ReflectionClass;

/**
 * Unit-tests the private scoreCandidate helper (Phase 2: fit + avoidance) without
 * MySQL. scoreCandidate is pure (no $this->pdo access), so we instantiate the
 * final class without a constructor and invoke via reflection.
 */
final class ProductRepositoryScoreTest extends TestCase
{
    private \ReflectionMethod $score;
    private ProductRepository $instance;

    protected function setUp(): void
    {
        $class = new ReflectionClass(ProductRepository::class);
        $this->instance = $class->newInstanceWithoutConstructor();
        $this->score = $class->getMethod('scoreCandidate');
    }

    /**
     * @param array<string, mixed> $candidate
     * @param array<int, string> $mood
     * @param array<int, string> $colors
     * @param array<int, string> $sourceIds
     * @param array<int, string> $avoidances
     */
    private function call(
        array $candidate,
        ?string $situation = null,
        array $mood = [],
        array $colors = [],
        array $sourceIds = [],
        ?string $fit = null,
        array $avoidances = [],
    ): int {
        return $this->score->invoke($this->instance, $candidate, $situation, $mood, $colors, $sourceIds, $fit, $avoidances);
    }

    private static function product(array $overrides = []): array
    {
        return array_merge([
            'publicId' => 'x1',
            'occasionTags' => [],
            'styleTags' => [],
            'colorFamily' => null,
            'fitType' => 'regular',
            'opacity' => 'opaque',
        ], $overrides);
    }

    public function testBaselineScoringIsPreserved(): void
    {
        $p = self::product(['occasionTags' => ['office'], 'styleTags' => ['minimal', 'clean'], 'colorFamily' => 'black']);
        // situation(+4) + mood overlap minimal(+2) + color black(+1) = 7
        $this->assertSame(7, $this->call($p, 'office', ['minimal'], ['black']));
    }

    public function testSourceProductBonus(): void
    {
        $p = self::product(['publicId' => 'src1']);
        $this->assertSame(5, $this->call($p, null, [], [], ['src1']));
    }

    public function testFitPreferenceMatchAddsBonus(): void
    {
        $oversized = self::product(['fitType' => 'oversized']);
        $slim = self::product(['fitType' => 'slim']);
        // 'oversized' preference maps to oversized target → +3 only for the oversized item.
        $this->assertSame(3, $this->call($oversized, null, [], [], [], 'oversized'));
        $this->assertSame(0, $this->call($slim, null, [], [], [], 'oversized'));
    }

    public function testRelaxedPreferenceMapsToOversized(): void
    {
        $oversized = self::product(['fitType' => 'oversized']);
        // FIT_TYPE_BY_PREFERENCE: relaxed → oversized
        $this->assertSame(3, $this->call($oversized, null, [], [], [], 'relaxed'));
    }

    public function testShoesWithNullFitAreFitNeutral(): void
    {
        $shoe = self::product(['fitType' => null]);
        // No fit bonus and no avoidance penalty applies to a fit-less shoe.
        $this->assertSame(0, $this->call($shoe, null, [], [], [], 'oversized', ['tight']));
    }

    public function testAvoidTightPenalizesSlim(): void
    {
        $slim = self::product(['fitType' => 'slim']);
        // avoid 'tight' → slim gets -4 (no fit pref here)
        $this->assertSame(-4, $this->call($slim, null, [], [], [], null, ['tight']));
    }

    public function testAvoidSheerPenalizesNonOpaque(): void
    {
        $semi = self::product(['opacity' => 'semi']);
        $opaque = self::product(['opacity' => 'opaque']);
        $this->assertSame(-4, $this->call($semi, null, [], [], [], null, ['sheer']));
        $this->assertSame(0, $this->call($opaque, null, [], [], [], null, ['sheer']));
    }

    public function testFitPreferenceAndAvoidanceCombine(): void
    {
        // User prefers slim (+3) but also avoids tight (-4) → net -1 for a slim item.
        $slim = self::product(['fitType' => 'slim']);
        $this->assertSame(-1, $this->call($slim, null, [], [], [], 'slim', ['tight']));
    }
}
