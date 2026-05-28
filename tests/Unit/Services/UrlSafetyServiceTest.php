<?php

declare(strict_types=1);

namespace PickFit\Tests\Unit\Services;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use PickFit\Services\UrlSafetyService;

/**
 * Unit-tests UrlSafetyService SSRF defenses. Tests that rely on DNS lookups
 * (localhost) use the OS hosts file and so are deterministic on every dev box.
 * Public-hostname positive tests are intentionally omitted from this suite —
 * they belong to integration tests under tests/Integration/.
 */
final class UrlSafetyServiceTest extends TestCase
{
    private UrlSafetyService $svc;

    protected function setUp(): void
    {
        $this->svc = new UrlSafetyService();
    }

    public function testEmptyUrlIsRejected(): void
    {
        $r = $this->svc->validate('');
        $this->assertFalse($r['ok']);
        $this->assertSame('invalid_url', $r['reason']);
    }

    public function testUrlBeyondLengthCapIsRejected(): void
    {
        $url = 'https://example.com/' . str_repeat('a', 2100);
        $r = $this->svc->validate($url);
        $this->assertFalse($r['ok']);
        $this->assertSame('url_too_long', $r['reason']);
    }

    /**
     * @param non-empty-string $url
     */
    #[DataProvider('disallowedSchemeProvider')]
    public function testSchemeIsRestrictedToHttpAndHttps(string $url): void
    {
        $r = $this->svc->validate($url);
        $this->assertFalse($r['ok']);
        $this->assertSame('scheme_not_allowed', $r['reason']);
    }

    public static function disallowedSchemeProvider(): array
    {
        return [
            'file'       => ['file:///etc/passwd'],
            'ftp'        => ['ftp://example.com/'],
            'javascript' => ['javascript:alert(1)'],
            'data uri'   => ['data:text/html,<script>alert(1)</script>'],
            'gopher'     => ['gopher://example.com/'],
            'ws'         => ['ws://example.com/'],
        ];
    }

    public function testCredentialsInUrlAreRejected(): void
    {
        $r = $this->svc->validate('http://user:pass@example.com/x');
        $this->assertFalse($r['ok']);
        $this->assertSame('credentials_in_url', $r['reason']);
    }

    /**
     * @param non-empty-string $url
     */
    #[DataProvider('disallowedPortProvider')]
    public function testPortsOutsideAllowlistAreRejected(string $url): void
    {
        $r = $this->svc->validate($url);
        $this->assertFalse($r['ok']);
        $this->assertSame('port_not_allowed', $r['reason']);
    }

    public static function disallowedPortProvider(): array
    {
        return [
            'ssh'   => ['http://1.1.1.1:22/'],
            'smtp'  => ['http://1.1.1.1:25/'],
            'mysql' => ['http://1.1.1.1:3306/'],
            'redis' => ['http://1.1.1.1:6379/'],
            'high'  => ['http://1.1.1.1:65000/'],
        ];
    }

    /**
     * @param non-empty-string $url
     */
    #[DataProvider('ambiguousNumericHostProvider')]
    public function testAmbiguousNumericHostsAreRejected(string $url): void
    {
        $r = $this->svc->validate($url);
        $this->assertFalse($r['ok']);
        $this->assertSame('ambiguous_numeric_host', $r['reason']);
    }

    public static function ambiguousNumericHostProvider(): array
    {
        // All of these resolve to 127.0.0.1 in browsers but bypass naive
        // dotted-quad parsers. They must be rejected at the host-normalization
        // stage before DNS resolution.
        return [
            'long decimal'  => ['http://2130706433/'],
            'hex prefix'    => ['http://0x7f000001/'],
            'mixed hex'     => ['http://0x7f.0.0.1/'],
            'octal'         => ['http://0177.0.0.1/'],
        ];
    }

    /**
     * @param non-empty-string $url
     */
    #[DataProvider('blockedIpv4Provider')]
    public function testIpv4BlockedRangesAreRejected(string $url): void
    {
        $r = $this->svc->validate($url);
        $this->assertFalse($r['ok']);
        $this->assertSame('ip_blocked', $r['reason']);
    }

    public static function blockedIpv4Provider(): array
    {
        return [
            'loopback'           => ['http://127.0.0.1/'],
            'any-zero'           => ['http://0.0.0.0/'],
            'private 10/8'       => ['http://10.0.0.1/'],
            'private 172.16'     => ['http://172.16.0.1/'],
            'private 192.168'    => ['http://192.168.1.1/'],
            'cgnat 100.64'       => ['http://100.64.0.1/'],
            'link-local 169.254' => ['http://169.254.169.254/'],
            'multicast'          => ['http://224.0.0.1/'],
            'reserved 240'       => ['http://240.0.0.1/'],
            'broadcast'          => ['http://255.255.255.255/'],
            'documentation'      => ['http://192.0.2.1/'],
            'documentation 203'  => ['http://203.0.113.1/'],
            'benchmarking'       => ['http://198.18.0.1/'],
        ];
    }

    /**
     * @param non-empty-string $url
     */
    #[DataProvider('blockedIpv6Provider')]
    public function testIpv6BlockedRangesAreRejected(string $url): void
    {
        $r = $this->svc->validate($url);
        $this->assertFalse($r['ok']);
        $this->assertSame('ip_blocked', $r['reason']);
    }

    public static function blockedIpv6Provider(): array
    {
        return [
            'loopback'              => ['http://[::1]/'],
            'unspecified'           => ['http://[::]/'],
            'link-local fe80'       => ['http://[fe80::1]/'],
            'unique-local fc00'     => ['http://[fc00::1]/'],
            'unique-local fd00'     => ['http://[fd00::1]/'],
            'multicast ff'          => ['http://[ff00::1]/'],
            'ipv4-mapped loopback'  => ['http://[::ffff:127.0.0.1]/'],
            'ipv4-mapped private'   => ['http://[::ffff:10.0.0.1]/'],
            'ipv4-compatible priv'  => ['http://[::10.0.0.1]/'],
            'nat64 well-known'      => ['http://[64:ff9b::7f00:1]/'],
        ];
    }

    public function testLocalhostHostnameResolvesToBlockedIp(): void
    {
        // Defends against the DNS-rebinding angle of naive validators that
        // only check IP literals — `localhost` must be resolved and rejected.
        $r = $this->svc->validate('http://localhost/x');
        $this->assertFalse($r['ok']);
        $this->assertSame('ip_blocked', $r['reason']);
    }

    public function testHostlessUrlIsRejected(): void
    {
        $r = $this->svc->validate('http:///path');
        $this->assertFalse($r['ok']);
        $this->assertContains($r['reason'], ['invalid_url', 'host_missing']);
    }

    public function testAllowedPortHttpsRoundTrip(): void
    {
        // IP literal in private space → rejected, but the URL parsing path
        // before IP check should not flag scheme/port. This proves explicit
        // port 443 in https is accepted by the port allowlist before
        // failing later on IP block — i.e. port allowlist is correct.
        $r = $this->svc->validate('https://10.0.0.1:443/x');
        $this->assertFalse($r['ok']);
        $this->assertSame('ip_blocked', $r['reason']);
    }
}
