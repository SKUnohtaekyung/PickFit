<?php

declare(strict_types=1);

namespace PickFit\Tests\Unit\Repositories;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use PickFit\Repositories\ProductRepository;
use ReflectionClass;

/**
 * Unit-tests the private sanitizeText helper on ProductRepository without
 * touching MySQL. PHPUnit cannot mock the final class plus PDO, so we
 * instantiate without a constructor and invoke the method via reflection.
 * sanitizeText does not access $this->pdo so this is safe.
 */
final class ProductRepositorySanitizeTest extends TestCase
{
    private \ReflectionMethod $sanitize;
    private ProductRepository $instance;

    protected function setUp(): void
    {
        $class = new ReflectionClass(ProductRepository::class);
        $this->instance = $class->newInstanceWithoutConstructor();
        $this->sanitize = $class->getMethod('sanitizeText');
    }

    private function call(string $value): string
    {
        return $this->sanitize->invoke($this->instance, $value);
    }

    #[DataProvider('stripProvider')]
    public function testStripsDangerousMarkup(string $input, string $shouldNotContain): void
    {
        $result = $this->call($input);
        $this->assertStringNotContainsStringIgnoringCase($shouldNotContain, $result);
    }

    public static function stripProvider(): array
    {
        return [
            'script tag'        => ['<script>alert(1)</script>Hello', '<script'],
            'img onerror'       => ['<img src=x onerror=alert(1)>Hello', '<img'],
            'svg onload'        => ['<svg/onload=alert(1)>Hello', '<svg'],
            'style block'       => ['<style>body{display:none}</style>x', '<style'],
            'anchor javascript' => ['<a href=javascript:alert(1)>슬랙스</a>', '<a '],
            'b onclick'         => ["<b onclick='steal()'>BRAND</b>", '<b '],
            'i tag'             => ['<i>네이비</i>', '<i>'],
        ];
    }

    public function testPreservesPlainText(): void
    {
        $this->assertSame('Slim Cotton Shirt', $this->call('Slim Cotton Shirt'));
    }

    public function testStripsControlCharacters(): void
    {
        $input = "hello\x00\x01\x07world\x7F";
        $this->assertSame('helloworld', $this->call($input));
    }

    public function testCollapsesWhitespace(): void
    {
        $input = "lots   of\t\n\nwhitespace";
        $this->assertSame('lots of whitespace', $this->call($input));
    }

    public function testTrimsBoundaryWhitespace(): void
    {
        $this->assertSame('center', $this->call("   center   "));
    }

    public function testRetainsTextContentInsideStrippedTags(): void
    {
        // strip_tags removes tags but preserves visible text — that's text, no
        // longer markup. Render layer must still escape.
        $this->assertSame('alert(1)Hello', $this->call('<script>alert(1)</script>Hello'));
    }

    public function testHandlesUnicodeAndZeroWidth(): void
    {
        // Zero-width space (U+200B) is technically not a control char and is
        // preserved (it's not in our control-char regex). Other text is intact.
        $result = $this->call("EVIL\nBRAND\u{200B}");
        $this->assertStringContainsString('EVIL', $result);
        $this->assertStringContainsString('BRAND', $result);
    }
}
