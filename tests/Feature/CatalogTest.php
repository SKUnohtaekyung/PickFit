<?php

declare(strict_types=1);

namespace PickFit\Tests\Feature;

use PickFit\Tests\Support\FeatureTestCase;

final class CatalogTest extends FeatureTestCase
{
    public function testListReturnsSeedProducts(): void
    {
        $resp = $this->http->get('/api/products?limit=3');

        $this->assertSame(200, $resp['status']);
        $this->assertTrue($resp['body']['ok'] ?? false);
        $products = $resp['body']['data']['products'] ?? null;
        $this->assertIsArray($products);
        $this->assertCount(3, $products);
        $this->assertArrayHasKey('id', $products[0]);
        $this->assertArrayHasKey('brandName', $products[0]);
        $this->assertArrayHasKey('productName', $products[0]);
    }

    public function testPaginationCursorAdvances(): void
    {
        $first = $this->http->get('/api/products?limit=3');
        $cursor = $first['body']['data']['nextCursor'] ?? null;
        $this->assertIsString($cursor);

        $second = $this->http->get('/api/products?limit=3&cursor=' . urlencode($cursor));
        $this->assertSame(200, $second['status']);
        $secondProducts = $second['body']['data']['products'] ?? [];
        $this->assertIsArray($secondProducts);
        if (count($secondProducts) > 0) {
            // Returned products must come after the cursor.
            $firstId = (string) ($secondProducts[0]['id'] ?? '');
            $this->assertGreaterThan($cursor, $firstId);
        }
    }

    public function testCategoryFilter(): void
    {
        $resp = $this->http->get('/api/products?category=top');

        $this->assertSame(200, $resp['status']);
        foreach ($resp['body']['data']['products'] ?? [] as $product) {
            $this->assertSame('top', $product['categoryMain'] ?? null);
        }
    }

    public function testMaxPriceFilter(): void
    {
        $cap = 45000;
        $resp = $this->http->get('/api/products?maxPrice=' . $cap);

        $this->assertSame(200, $resp['status']);
        foreach ($resp['body']['data']['products'] ?? [] as $product) {
            $price = $product['priceSale'] ?? null;
            if ($price !== null) {
                $this->assertLessThanOrEqual($cap, (int) $price);
            }
        }
    }

    public function testProductDetailReturnsRichShape(): void
    {
        // Resolve a real product id from the list rather than a hardcoded seed id —
        // seed rows can be pruned from the dev catalog, so the detail shape is
        // asserted against whatever product currently exists.
        $list = $this->http->get('/api/products?limit=1');
        $publicId = $list['body']['data']['products'][0]['id'] ?? null;
        $this->assertIsString($publicId);

        $resp = $this->http->get('/api/products/' . urlencode($publicId));

        $this->assertSame(200, $resp['status']);
        $product = $resp['body']['data']['product'] ?? null;
        $this->assertIsArray($product);
        $this->assertSame($publicId, $product['id'] ?? null);
        $this->assertArrayHasKey('variants', $product);
        $this->assertArrayHasKey('media', $product);
    }

    public function testProductDetailReturns404ForUnknownId(): void
    {
        $resp = $this->http->get('/api/products/no-such-product');

        $this->assertSame(404, $resp['status']);
        $this->assertSame('not_found', $resp['body']['error']['code'] ?? null);
    }
}
