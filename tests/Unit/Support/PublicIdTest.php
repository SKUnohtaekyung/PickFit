<?php

declare(strict_types=1);

namespace PickFit\Tests\Unit\Support;

use PHPUnit\Framework\TestCase;
use PickFit\Support\PublicId;

final class PublicIdTest extends TestCase
{
    private const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    public function testGenerateReturns26Characters(): void
    {
        $id = PublicId::generate();
        $this->assertSame(26, strlen($id));
    }

    public function testGenerateUsesCrockfordBase32Alphabet(): void
    {
        $id = PublicId::generate();
        $allowed = self::CROCKFORD_ALPHABET;
        for ($i = 0; $i < strlen($id); $i++) {
            $char = $id[$i];
            $this->assertTrue(
                str_contains($allowed, $char),
                "character '$char' at position $i is not in Crockford alphabet"
            );
        }
    }

    public function testGenerateProducesDistinctIdsAcrossManyCalls(): void
    {
        $set = [];
        for ($i = 0; $i < 200; $i++) {
            $set[PublicId::generate()] = true;
        }
        $this->assertCount(200, $set, 'Expected 200 distinct IDs across 200 calls');
    }

    public function testTimestampPrefixIsLexicographicallyOrdered(): void
    {
        $first = PublicId::generate();
        usleep(2000); // 2ms gap so the millisecond timestamp moves
        $second = PublicId::generate();

        // Timestamp section is the first 10 chars; later call must be >= earlier call.
        $this->assertGreaterThanOrEqual(
            substr($first, 0, 10),
            substr($second, 0, 10),
            'Second-generated ID has an earlier timestamp prefix than the first'
        );
    }
}
