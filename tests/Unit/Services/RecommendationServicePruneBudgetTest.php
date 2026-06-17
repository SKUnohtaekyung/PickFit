<?php

declare(strict_types=1);

namespace PickFit\Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use PickFit\Services\RecommendationService;
use ReflectionClass;

/**
 * Unit-tests the private pruneByBudget helper (Phase 1) without MySQL/OpenAI.
 * pruneByBudget is pure (no injected deps), so we instantiate the final class
 * without a constructor and invoke via reflection — same pattern as
 * ProductRepositorySanitizeTest.
 */
final class RecommendationServicePruneBudgetTest extends TestCase
{
    private \ReflectionMethod $prune;
    private RecommendationService $instance;

    protected function setUp(): void
    {
        $class = new ReflectionClass(RecommendationService::class);
        $this->instance = $class->newInstanceWithoutConstructor();
        $this->prune = $class->getMethod('pruneByBudget');
    }

    /**
     * @param array<string, array<int, array<string, mixed>>> $candidates
     * @return array{candidates: array<string, array<int, array<string, mixed>>>, relaxed: bool}
     */
    private function call(array $candidates, ?int $cap): array
    {
        return $this->prune->invoke($this->instance, $candidates, $cap);
    }

    /**
     * @param array<int, array{publicId: string, priceSale: int}> $items
     * @return array<int, string>
     */
    private static function ids(array $items): array
    {
        return array_map(static fn (array $p): string => (string) $p['publicId'], $items);
    }

    private static function pool(int ...$prices): array
    {
        $out = [];
        foreach ($prices as $i => $price) {
            $out[] = ['publicId' => 'p' . $price . '_' . $i, 'priceSale' => $price];
        }
        return $out;
    }

    public function testNullCapReturnsCandidatesUnchanged(): void
    {
        $candidates = [
            'top' => self::pool(10000, 90000),
            'bottom' => self::pool(20000),
            'shoes' => self::pool(30000),
            'outer' => [],
        ];
        $result = $this->call($candidates, null);
        $this->assertFalse($result['relaxed']);
        $this->assertSame($candidates, $result['candidates']);
    }

    public function testKeepsOnlyWithinBudgetWhenEnoughRemain(): void
    {
        $candidates = [
            'top' => self::pool(10000, 20000, 30000, 40000, 90000), // 4 within 50k
            'bottom' => self::pool(15000, 25000, 35000),
            'shoes' => self::pool(45000, 48000, 49000),
            'outer' => [],
        ];
        $result = $this->call($candidates, 50000);

        $this->assertFalse($result['relaxed'], 'no relaxation when ≥3 items fit the cap');
        foreach (['top', 'bottom', 'shoes'] as $slot) {
            foreach ($result['candidates'][$slot] as $item) {
                $this->assertLessThanOrEqual(50000, $item['priceSale'], "$slot kept an over-budget item");
            }
        }
        // The over-budget 90000 top must be dropped.
        $this->assertNotContains('p90000_4', self::ids($result['candidates']['top']));
    }

    public function testPreservesRelevanceOrderOfWithinBudgetItems(): void
    {
        // Input order represents relevance ranking; within-budget filter must keep it.
        $candidates = [
            'top' => [
                ['publicId' => 'a', 'priceSale' => 10000],
                ['publicId' => 'b', 'priceSale' => 99000], // over cap → dropped
                ['publicId' => 'c', 'priceSale' => 20000],
                ['publicId' => 'd', 'priceSale' => 30000],
            ],
            'bottom' => self::pool(10000, 20000, 30000),
            'shoes' => self::pool(10000, 20000, 30000),
            'outer' => [],
        ];
        $result = $this->call($candidates, 50000);
        $this->assertSame(['a', 'c', 'd'], self::ids($result['candidates']['top']));
    }

    public function testRelaxesRequiredSlotToCheapestWhenTooFewFit(): void
    {
        // Only 1 shoe within cap; needs ≥3 → fill with cheapest over-budget ones.
        $candidates = [
            'top' => self::pool(10000, 20000, 30000),
            'bottom' => self::pool(10000, 20000, 30000),
            'shoes' => [
                ['publicId' => 'cheap', 'priceSale' => 40000],
                ['publicId' => 'mid', 'priceSale' => 120000],
                ['publicId' => 'pricey', 'priceSale' => 200000],
                ['publicId' => 'most', 'priceSale' => 90000],
            ],
            'outer' => [],
        ];
        $result = $this->call($candidates, 50000);

        $this->assertTrue($result['relaxed'], 'relaxation flag must be set when over-budget items are added');
        $shoes = self::ids($result['candidates']['shoes']);
        $this->assertCount(3, $shoes, 'required slot kept at floor of 3 for coverage');
        $this->assertSame('cheap', $shoes[0], 'within-budget item stays first');
        // Filled with the two cheapest over-budget shoes (90000, 120000) — not 200000.
        $this->assertContains('most', $shoes);
        $this->assertContains('mid', $shoes);
        $this->assertNotContains('pricey', $shoes);
    }

    public function testOuterIsNotForcedToFloor(): void
    {
        // outer is optional — no relaxation/backfill even if nothing fits.
        $candidates = [
            'top' => self::pool(10000, 20000, 30000),
            'bottom' => self::pool(10000, 20000, 30000),
            'shoes' => self::pool(10000, 20000, 30000),
            'outer' => self::pool(300000), // over cap
        ];
        $result = $this->call($candidates, 50000);
        $this->assertFalse($result['relaxed']);
        $this->assertSame([], $result['candidates']['outer']);
    }
}
