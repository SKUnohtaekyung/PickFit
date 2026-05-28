<?php

declare(strict_types=1);

namespace PickFit\Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use PickFit\Services\CrawlerService;
use ReflectionClass;
use ReflectionMethod;

/**
 * Unit-tests the pure-function helpers inside CrawlerService (parsePayload,
 * pickHeroImage, buildExtractionPayload, safeStderrTail) without invoking
 * Playwright or hitting MySQL. CrawlerService is final and pulls heavy
 * dependencies, so we instantiate it without a constructor and reach the
 * private methods via reflection — none of them touch $this state.
 */
final class CrawlerServiceHelpersTest extends TestCase
{
    private CrawlerService $instance;
    private ReflectionClass $class;

    protected function setUp(): void
    {
        $this->class = new ReflectionClass(CrawlerService::class);
        $this->instance = $this->class->newInstanceWithoutConstructor();
    }

    private function call(string $method, mixed ...$args): mixed
    {
        $m = $this->class->getMethod($method);
        return $m->invoke($this->instance, ...$args);
    }

    // --- parsePayload --------------------------------------------------------

    public function testParsePayloadDecodesValidJson(): void
    {
        $result = $this->call('parsePayload', '{"ok":true,"extracted":{"productName":"X"}}');
        $this->assertIsArray($result);
        $this->assertTrue($result['ok']);
        $this->assertSame('X', $result['extracted']['productName']);
    }

    public function testParsePayloadReturnsNullOnEmpty(): void
    {
        $this->assertNull($this->call('parsePayload', ''));
        $this->assertNull($this->call('parsePayload', "   \n\t"));
    }

    public function testParsePayloadReturnsNullOnInvalidJson(): void
    {
        $this->assertNull($this->call('parsePayload', '{not json}'));
        $this->assertNull($this->call('parsePayload', '<html>not json</html>'));
    }

    public function testParsePayloadStripsUtf8Bom(): void
    {
        $result = $this->call('parsePayload', "\xEF\xBB\xBF" . '{"ok":true}');
        $this->assertIsArray($result);
        $this->assertTrue($result['ok']);
    }

    public function testParsePayloadReturnsNullForNonObjectJson(): void
    {
        $this->assertNull($this->call('parsePayload', '"string"'));
        $this->assertNull($this->call('parsePayload', '42'));
    }

    // --- pickHeroImage -------------------------------------------------------

    public function testPickHeroImagePrefersFirstImageUrl(): void
    {
        $payload = [
            'extracted' => [
                'imageUrls' => ['https://cdn.example/img1.jpg', 'https://cdn.example/img2.jpg'],
            ],
            'meta' => ['ogImage' => 'https://og.example/og.jpg'],
        ];
        $this->assertSame('https://cdn.example/img1.jpg', $this->call('pickHeroImage', $payload));
    }

    public function testPickHeroImageFallsBackToOgImage(): void
    {
        $payload = [
            'extracted' => ['imageUrls' => []],
            'meta' => ['ogImage' => 'https://og.example/og.jpg'],
        ];
        $this->assertSame('https://og.example/og.jpg', $this->call('pickHeroImage', $payload));
    }

    public function testPickHeroImageSkipsEmptyEntriesInImageUrls(): void
    {
        $payload = [
            'extracted' => ['imageUrls' => ['', null, 'https://valid.example/img.jpg']],
            'meta' => [],
        ];
        $this->assertSame('https://valid.example/img.jpg', $this->call('pickHeroImage', $payload));
    }

    public function testPickHeroImageReturnsNullWhenNothingAvailable(): void
    {
        $payload = [
            'extracted' => ['imageUrls' => []],
            'meta' => [],
        ];
        $this->assertNull($this->call('pickHeroImage', $payload));
    }

    // --- buildExtractionPayload ---------------------------------------------

    public function testBuildExtractionPayloadFlattensExtractedAndMeta(): void
    {
        $parsed = [
            'extracted' => [
                'productName' => 'Shirt',
                'brandName' => 'Brand',
                'description' => 'desc',
                'priceCandidates' => [49000],
                'currencyCandidates' => ['KRW'],
                'imageUrls' => array_fill(0, 12, 'https://img.example/x.jpg'),
                'text' => str_repeat('A', 8000),
            ],
            'meta' => [
                'ogTitle' => 'OG Title',
                'ogDescription' => 'OG Desc',
                'ogImage' => 'https://og.example/img.jpg',
                'jsonLd' => ['@type' => 'Product'],
            ],
        ];

        $result = $this->call('buildExtractionPayload', $parsed, 'https://final.example/p/1');

        $this->assertSame('https://final.example/p/1', $result['finalUrl']);
        $this->assertSame('Shirt', $result['productName']);
        $this->assertSame('Brand', $result['brandName']);
        $this->assertSame([49000], $result['priceCandidates']);
        $this->assertCount(8, $result['imageUrls'], 'imageUrls trimmed to 8');
        $this->assertLessThanOrEqual(6000, mb_strlen($result['text']), 'text trimmed to 6000 chars');
        $this->assertSame('OG Title', $result['meta']['ogTitle']);
    }

    public function testBuildExtractionPayloadHandlesMissingSections(): void
    {
        $result = $this->call('buildExtractionPayload', [], 'https://example.com/');

        $this->assertSame('https://example.com/', $result['finalUrl']);
        $this->assertNull($result['productName']);
        $this->assertNull($result['brandName']);
        $this->assertSame([], $result['imageUrls']);
        $this->assertNull($result['text']);
    }

    // --- safeStderrTail ------------------------------------------------------

    public function testSafeStderrTailHasFallbackForEmpty(): void
    {
        $out = $this->call('safeStderrTail', '');
        $this->assertSame('Worker did not produce a valid response.', $out);
    }

    public function testSafeStderrTailStripsAnsiEscapes(): void
    {
        $stderr = "[31mERROR[0m: navigation failed";
        $stderr = "\e[31mERROR\e[0m: navigation failed";
        $out = $this->call('safeStderrTail', $stderr);
        $this->assertStringNotContainsString("\e[", $out);
        $this->assertStringContainsString('ERROR', $out);
    }

    public function testSafeStderrTailStripsControlCharacters(): void
    {
        $stderr = "before\x00\x01\x07after";
        $out = $this->call('safeStderrTail', $stderr);
        $this->assertStringContainsString('before', $out);
        $this->assertStringContainsString('after', $out);
        $this->assertStringNotContainsString("\x00", $out);
    }
}
