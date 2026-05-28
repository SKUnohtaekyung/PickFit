<?php

declare(strict_types=1);

namespace PickFit\Tests\Feature;

use PickFit\Tests\Support\FeatureTestCase;

final class HealthEndpointTest extends FeatureTestCase
{
    public function testHealthReturns200WithExpectedShape(): void
    {
        $resp = $this->http->get('/api/health');

        $this->assertSame(200, $resp['status']);
        $this->assertTrue($resp['body']['ok'] ?? false);
        $this->assertSame('PickFit', $resp['body']['app'] ?? null);
        $this->assertSame('local', $resp['body']['environment'] ?? null);
    }

    public function testCsrfReturns200WithToken(): void
    {
        $resp = $this->http->get('/api/csrf');

        $this->assertSame(200, $resp['status']);
        $this->assertTrue($resp['body']['ok'] ?? false);
        $token = $resp['body']['data']['csrfToken'] ?? null;
        $this->assertIsString($token);
        $this->assertSame(64, strlen($token));
    }

    public function testUnknownApiRouteReturns404TypedError(): void
    {
        $resp = $this->http->get('/api/no-such-endpoint');

        $this->assertSame(404, $resp['status']);
        $this->assertFalse($resp['body']['ok'] ?? true);
        $this->assertSame('route_not_found', $resp['body']['error']['code'] ?? null);
    }
}
