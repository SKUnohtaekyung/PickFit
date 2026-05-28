<?php

declare(strict_types=1);

namespace PickFit\Tests\Unit\Support;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use PickFit\Support\JsonColumn;

final class JsonColumnTest extends TestCase
{
    /**
     * @param array<int|string, mixed> $expected
     */
    #[DataProvider('decodeProvider')]
    public function testDecode(mixed $input, array $expected): void
    {
        $this->assertSame($expected, JsonColumn::decode($input));
    }

    public static function decodeProvider(): array
    {
        return [
            'null'              => [null, []],
            'empty string'      => ['', []],
            'non-array json'    => ['"plain string"', []],
            'invalid json'      => ['not json', []],
            'integer'           => [42, []],
            'object json'       => ['{"a":1,"b":"two"}', ['a' => 1, 'b' => 'two']],
            'list json'         => ['[1,2,3]', [0 => 1, 1 => 2, 2 => 3]],
            'unicode'           => ['{"k":"한글"}', ['k' => '한글']],
        ];
    }
}
