<?php

declare(strict_types=1);

namespace PickFit\Tests\Feature;

use PDO;
use PHPUnit\Framework\TestCase;
use PickFit\Config;
use PickFit\Database;
use PickFit\Repositories\ProductRepository;
use PickFit\Repositories\RecommendationRepository;
use PickFit\Repositories\UserRepository;
use PickFit\Services\OpenAIService;
use PickFit\Services\RecommendationService;
use PickFit\Support\ResponseValidator;

/**
 * End-to-end regression for the recommendation-variance fix: changing conditions
 * must change the recommended products. Exercises the DETERMINISTIC fallback
 * (empty schema forces assembleOutfits — no OpenAI), so it is stable in CI.
 *
 * Needs MySQL with the seeded catalog; skips if the DB is unreachable. Does NOT
 * need the HTTP dev server (calls the service directly).
 */
final class RecommendationVarianceTest extends TestCase
{
    private ?PDO $pdo = null;
    private RecommendationService $service;
    private int $userId = 0;

    protected function setUp(): void
    {
        $projectRoot = realpath(__DIR__ . '/../..') ?: __DIR__;
        try {
            $config = Config::fromEnvironment($projectRoot);
            $this->pdo = (new Database($config))->pdo();
        } catch (\Throwable $e) {
            $this->markTestSkipped('DB not reachable: ' . $e->getMessage());
        }

        $caCertPath = $projectRoot . '/storage/certs/cacert.pem';
        $openAi = new OpenAIService(
            $config,
            $projectRoot . '/src/Support/prompts',
            null,
            is_file($caCertPath) ? $caCertPath : null,
        );
        // Empty schema → forces the deterministic fallback assembler.
        $this->service = new RecommendationService(
            new ProductRepository($this->pdo),
            new RecommendationRepository($this->pdo),
            $openAi,
            new ResponseValidator(),
            '',
        );

        $users = new UserRepository($this->pdo);
        $user = $users->create(
            'reco-variance-' . bin2hex(random_bytes(4)) . '@test.local',
            password_hash('temp', PASSWORD_DEFAULT),
            'VarianceTest',
        );
        $this->userId = (int) $user['id'];
    }

    protected function tearDown(): void
    {
        if ($this->pdo !== null && $this->userId > 0) {
            $this->pdo->exec('DELETE FROM users WHERE id = ' . $this->userId);
        }
    }

    /** @param array<string, mixed> $overrides */
    private function conditions(array $overrides = []): array
    {
        return array_merge([
            'situation' => 'office',
            'budget' => '50k-100k',
            'fit' => 'slim',
            'mood' => ['minimal'],
            'bodyType' => [],
            'colors' => [],
            'avoidances' => [],
            'freeText' => null,
        ], $overrides);
    }

    /** Canonical signature of a run: per-outfit "slot:productId", order-stable. */
    private function signature(array $result): string
    {
        $lines = [];
        foreach ($result['outfits'] as $o) {
            $parts = [];
            foreach ($o['items'] as $it) {
                $parts[] = $it['slot'] . ':' . $it['productPublicId'];
            }
            sort($parts);
            $lines[] = implode(',', $parts);
        }
        return implode('|', $lines);
    }

    /** @return array<int, string> all productPublicIds across every outfit */
    private function allProductIds(array $result): array
    {
        $ids = [];
        foreach ($result['outfits'] as $o) {
            foreach ($o['items'] as $it) {
                $ids[] = (string) $it['productPublicId'];
            }
        }
        return $ids;
    }

    public function testBudgetChangesPicks(): void
    {
        $cheap = $this->service->generate($this->userId, $this->conditions(['budget' => 'under50k']), []);
        $rich = $this->service->generate($this->userId, $this->conditions(['budget' => 'over200k']), []);
        $this->assertNotSame(
            $this->signature($cheap),
            $this->signature($rich),
            'changing budget under50k → over200k must change the recommended products',
        );
    }

    public function testBudgetCapIsHonoredWhenSatisfiable(): void
    {
        // under50k cap = 50,000 per item; the catalog has ≥3 sub-50k items per slot,
        // so every picked item should respect the cap (no relaxation needed).
        $result = $this->service->generate($this->userId, $this->conditions(['budget' => 'under50k']), []);
        foreach ($result['outfits'] as $o) {
            foreach ($o['items'] as $it) {
                $price = (int) ($it['product']['priceSale'] ?? 0);
                $this->assertLessThanOrEqual(50000, $price, 'item exceeded the per-item budget cap');
            }
        }
    }

    public function testFitChangesPicks(): void
    {
        $slim = $this->service->generate($this->userId, $this->conditions(['fit' => 'slim']), []);
        $over = $this->service->generate($this->userId, $this->conditions(['fit' => 'oversized']), []);
        $this->assertNotSame(
            $this->signature($slim),
            $this->signature($over),
            'changing fit preference must change the recommended products',
        );
    }

    public function testSituationChangesPicks(): void
    {
        $office = $this->service->generate($this->userId, $this->conditions(['situation' => 'office']), []);
        $date = $this->service->generate($this->userId, $this->conditions(['situation' => 'date']), []);
        $this->assertNotSame(
            $this->signature($office),
            $this->signature($date),
            'changing situation office → date must change the recommended products (data fix)',
        );
    }

    public function testThreeOutfitsAreDisjoint(): void
    {
        // Roomy budget so pools are abundant; the greedy assembler must produce
        // 3 outfits with no product reused across cards (markUsed/excludeUsed).
        $result = $this->service->generate($this->userId, $this->conditions(['budget' => 'over200k']), []);
        $ids = $this->allProductIds($result);
        $this->assertCount(9, $ids, 'expected 3 outfits × 3 required slots = 9 items');
        $this->assertSame(
            count($ids),
            count(array_unique($ids)),
            'no product should repeat across the 3 outfit cards',
        );
    }

    public function testVariedConditionsProduceManyDistinctOutfitSets(): void
    {
        $cases = [
            $this->conditions(),
            $this->conditions(['situation' => 'date']),
            $this->conditions(['budget' => 'under50k']),
            $this->conditions(['budget' => 'over200k']),
            $this->conditions(['fit' => 'oversized']),
            $this->conditions(['colors' => ['black']]),
            $this->conditions(['situation' => 'date', 'budget' => 'over200k', 'fit' => 'oversized', 'colors' => ['black']]),
        ];
        $signatures = [];
        foreach ($cases as $c) {
            $signatures[] = $this->signature($this->service->generate($this->userId, $c, []));
        }
        $distinct = count(array_unique($signatures));
        // Pre-fix this collapsed to ~1–2 distinct sets; require a healthy spread now.
        $this->assertGreaterThanOrEqual(5, $distinct, "expected ≥5 distinct outfit-sets across 7 cases, got {$distinct}");
    }
}
