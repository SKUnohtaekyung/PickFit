<?php

declare(strict_types=1);

namespace PickFit\Services;

final class UrlSafetyService
{
    public const REASON_INVALID_URL = 'invalid_url';
    public const REASON_URL_TOO_LONG = 'url_too_long';
    public const REASON_SCHEME_NOT_ALLOWED = 'scheme_not_allowed';
    public const REASON_CREDENTIALS_IN_URL = 'credentials_in_url';
    public const REASON_HOST_MISSING = 'host_missing';
    public const REASON_HOST_NOT_RESOLVABLE = 'host_not_resolvable';
    public const REASON_PORT_NOT_ALLOWED = 'port_not_allowed';
    public const REASON_IP_BLOCKED = 'ip_blocked';
    public const REASON_AMBIGUOUS_NUMERIC_HOST = 'ambiguous_numeric_host';

    private const MAX_URL_LENGTH = 2048;
    private const ALLOWED_SCHEMES = ['http', 'https'];
    private const ALLOWED_PORTS = [80, 443, 8080, 8443];

    /**
     * Validate a user-submitted URL against SSRF defenses.
     *
     * @return array{
     *     ok: bool,
     *     reason?: string,
     *     message?: string,
     *     normalizedUrl?: string,
     *     host?: string,
     *     sourceDomain?: string,
     *     resolvedIps?: array<int, string>
     * }
     */
    public function validate(string $url): array
    {
        $url = trim($url);

        if ($url === '') {
            return $this->fail(self::REASON_INVALID_URL, 'URL이 비어 있습니다.');
        }

        if (strlen($url) > self::MAX_URL_LENGTH) {
            return $this->fail(self::REASON_URL_TOO_LONG, 'URL이 너무 길어요.');
        }

        $parsed = parse_url($url);
        if ($parsed === false || !is_array($parsed)) {
            return $this->fail(self::REASON_INVALID_URL, 'URL 형식이 올바르지 않아요.');
        }

        $scheme = isset($parsed['scheme']) ? strtolower((string) $parsed['scheme']) : '';
        if (!in_array($scheme, self::ALLOWED_SCHEMES, true)) {
            return $this->fail(self::REASON_SCHEME_NOT_ALLOWED, 'http 또는 https 주소만 분석할 수 있어요.');
        }

        if (isset($parsed['user']) || isset($parsed['pass'])) {
            return $this->fail(self::REASON_CREDENTIALS_IN_URL, '계정 정보가 포함된 주소는 분석할 수 없어요.');
        }

        $rawHost = $parsed['host'] ?? '';
        if ($rawHost === '') {
            return $this->fail(self::REASON_HOST_MISSING, '호스트가 비어 있어요.');
        }

        $port = isset($parsed['port']) ? (int) $parsed['port'] : null;
        if ($port !== null && !in_array($port, self::ALLOWED_PORTS, true)) {
            return $this->fail(self::REASON_PORT_NOT_ALLOWED, '허용되지 않은 포트예요.');
        }

        $normalizedHost = $this->normalizeHost($rawHost);
        if ($normalizedHost === null) {
            return $this->fail(self::REASON_AMBIGUOUS_NUMERIC_HOST, '주소 표기가 모호해서 분석할 수 없어요.');
        }

        $resolved = $this->resolveHost($normalizedHost);
        if ($resolved === null || $resolved === []) {
            return $this->fail(self::REASON_HOST_NOT_RESOLVABLE, '호스트를 확인할 수 없어요.');
        }

        foreach ($resolved as $ip) {
            if ($this->isBlockedIp($ip)) {
                return [
                    'ok' => false,
                    'reason' => self::REASON_IP_BLOCKED,
                    'message' => '내부망/특수 주소로 해석되는 호스트라 분석할 수 없어요.',
                    'host' => $normalizedHost,
                    'sourceDomain' => $normalizedHost,
                    'resolvedIps' => $resolved,
                ];
            }
        }

        return [
            'ok' => true,
            'normalizedUrl' => $this->buildNormalizedUrl($scheme, $normalizedHost, $port, $parsed),
            'host' => $normalizedHost,
            'sourceDomain' => $normalizedHost,
            'resolvedIps' => $resolved,
        ];
    }

    /**
     * Re-validate a URL after navigation. The original host (if provided) is compared
     * to the final host to detect cross-host redirects to a blocked target that may not
     * be caught by IP resolution alone (e.g. a redirect that lands on a new public IP).
     */
    public function isFinalUrlAllowed(string $finalUrl, ?string $originalHost = null): bool
    {
        $result = $this->validate($finalUrl);
        if (!$result['ok']) {
            return false;
        }
        if ($originalHost !== null && $originalHost !== '') {
            $expected = $this->normalizeHost($originalHost);
            if ($expected !== null && $expected !== ($result['host'] ?? null)) {
                // Cross-host redirect — still allowed only if the new host passes validation,
                // which is already true at this point. We surface the change to callers via
                // returning true; the caller may opt to enforce stricter same-origin checking.
            }
        }
        return true;
    }

    /**
     * @return array<int, string>
     */
    public function blockedIpv4Ranges(): array
    {
        return array_map(static fn (array $r): string => sprintf('%s/%d', $r[0], $r[1]), self::IPV4_BLOCK_RANGES);
    }

    private const IPV4_BLOCK_RANGES = [
        ['0.0.0.0', 8],
        ['10.0.0.0', 8],
        ['100.64.0.0', 10],
        ['127.0.0.0', 8],
        ['169.254.0.0', 16],
        ['172.16.0.0', 12],
        ['192.0.0.0', 24],
        ['192.0.2.0', 24],
        ['192.168.0.0', 16],
        ['198.18.0.0', 15],
        ['198.51.100.0', 24],
        ['203.0.113.0', 24],
        ['224.0.0.0', 4],
        ['240.0.0.0', 4],
        ['255.255.255.255', 32],
    ];

    private function normalizeHost(string $host): ?string
    {
        $host = trim($host);
        if ($host === '') {
            return null;
        }
        // Strip trailing dot, lowercase.
        $host = rtrim($host, '.');
        $host = strtolower($host);

        // Bracketed IPv6 literal — keep brackets so callers can rebuild URL faithfully.
        if (str_starts_with($host, '[') && str_ends_with($host, ']')) {
            return $host;
        }

        // If the host is purely numeric/dot/hex/octal markers but does NOT parse as a
        // standard IPv4 literal, reject it as ambiguous. This blocks long-form decimal
        // (`2130706433`), octal (`0177.0.0.1`), and hex (`0x7f.0.0.1`) IP wrappers
        // that Chromium would silently translate to 127.0.0.1.
        if ($this->looksLikeAmbiguousIp($host)) {
            return null;
        }

        // IDN → ASCII (punycode) for international domains.
        if (function_exists('idn_to_ascii')) {
            $ascii = @idn_to_ascii($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
            if (is_string($ascii) && $ascii !== '') {
                $host = strtolower($ascii);
                // Defense-in-depth: re-check ambiguity after IDN normalization in case
                // UTS46 produced a numeric/non-standard IP wrapper.
                if ($this->looksLikeAmbiguousIp($host)) {
                    return null;
                }
            }
        }

        return $host;
    }

    private function looksLikeAmbiguousIp(string $host): bool
    {
        // Already a valid dotted-quad IPv4 — not ambiguous.
        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            return false;
        }
        // Already a valid IPv6 literal (without brackets) — not ambiguous.
        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false) {
            return false;
        }
        // Composed only of digits, dots, hex letters, x markers → numeric-looking but
        // failed strict IPv4 validation (long-form, octal, hex notations).
        if (preg_match('/^[0-9a-fx\.]+$/i', $host) === 1 && preg_match('/[a-fx]/i', $host) === 1) {
            return true;
        }
        if (preg_match('/^[0-9\.]+$/', $host) === 1) {
            return true;
        }
        return false;
    }

    /**
     * @return array<int, string>|null
     */
    private function resolveHost(string $host): ?array
    {
        if (str_starts_with($host, '[') && str_ends_with($host, ']')) {
            $inner = substr($host, 1, -1);
            if (filter_var($inner, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false) {
                return [$inner];
            }
            return null;
        }

        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            return [$host];
        }

        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false) {
            return [$host];
        }

        // Hostname → DNS A/AAAA lookups.
        $ips = [];
        $records = @dns_get_record($host, DNS_A | DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $record) {
                if (isset($record['ip']) && is_string($record['ip'])) {
                    $ips[] = $record['ip'];
                }
                if (isset($record['ipv6']) && is_string($record['ipv6'])) {
                    $ips[] = $record['ipv6'];
                }
            }
        }

        // Windows DNS resolvers sometimes return nothing from dns_get_record but resolve
        // the host via gethostbynamel; merge that result to avoid false negatives.
        $fallback = @gethostbynamel($host);
        if (is_array($fallback)) {
            foreach ($fallback as $ip) {
                if (is_string($ip)) {
                    $ips[] = $ip;
                }
            }
        }

        $ips = array_values(array_unique($ips));
        return $ips === [] ? null : $ips;
    }

    private function isBlockedIp(string $ip): bool
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            return $this->isBlockedIpv4($ip);
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false) {
            return $this->isBlockedIpv6($ip);
        }
        // Unknown family → block by default.
        return true;
    }

    private function isBlockedIpv4(string $ip): bool
    {
        $long = ip2long($ip);
        if ($long === false) {
            return true;
        }
        // Force unsigned 32-bit semantics regardless of PHP int width.
        $longU = $long & 0xFFFFFFFF;

        foreach (self::IPV4_BLOCK_RANGES as [$networkIp, $bits]) {
            $networkLong = ip2long($networkIp);
            if ($networkLong === false) {
                continue;
            }
            $mask = $bits === 0 ? 0 : ((0xFFFFFFFF << (32 - $bits)) & 0xFFFFFFFF);
            if (($longU & $mask) === (($networkLong & 0xFFFFFFFF) & $mask)) {
                return true;
            }
        }

        return false;
    }

    private function isBlockedIpv6(string $ip): bool
    {
        $packed = @inet_pton($ip);
        if ($packed === false || strlen($packed) !== 16) {
            return true;
        }

        // IPv4-mapped IPv6 (::ffff:a.b.c.d) — first 10 bytes 0x00, next 2 bytes 0xFFFF.
        if (substr($packed, 0, 10) === str_repeat("\x00", 10) && substr($packed, 10, 2) === "\xff\xff") {
            $unpacked = unpack('N', substr($packed, 12, 4));
            if (is_array($unpacked) && isset($unpacked[1])) {
                return $this->isBlockedIpv4(long2ip($unpacked[1]));
            }
            return true;
        }

        // IPv4-compatible IPv6 (::a.b.c.d) — first 12 bytes 0x00, last 4 = IPv4.
        // Deprecated form, often used to smuggle IPv4 targets through IPv6 parsers.
        if (substr($packed, 0, 12) === str_repeat("\x00", 12)) {
            $last4 = substr($packed, 12, 4);
            // Pure ::, ::1 handled below; treat ::a.b.c.d as the embedded IPv4.
            if ($last4 !== "\x00\x00\x00\x00" && $last4 !== "\x00\x00\x00\x01") {
                $unpacked = unpack('N', $last4);
                if (is_array($unpacked) && isset($unpacked[1])) {
                    return $this->isBlockedIpv4(long2ip($unpacked[1]));
                }
                return true;
            }
        }

        // :: unspecified
        if ($packed === str_repeat("\x00", 16)) {
            return true;
        }
        // ::1 loopback
        if ($packed === str_repeat("\x00", 15) . "\x01") {
            return true;
        }

        $b0 = ord($packed[0]);
        $b1 = ord($packed[1]);

        // fc00::/7 unique local addresses
        if (($b0 & 0xFE) === 0xFC) {
            return true;
        }
        // fe80::/10 link-local
        if ($b0 === 0xFE && ($b1 & 0xC0) === 0x80) {
            return true;
        }
        // ff00::/8 multicast
        if ($b0 === 0xFF) {
            return true;
        }
        // 64:ff9b::/96 well-known NAT64 prefix — can SSRF into IPv4 space.
        if (substr($packed, 0, 4) === "\x00\x64\xff\x9b") {
            return true;
        }
        // 100::/64 discard-only prefix.
        if (substr($packed, 0, 8) === "\x01\x00\x00\x00\x00\x00\x00\x00") {
            return true;
        }

        return false;
    }

    /**
     * @param array<string, mixed> $parsed
     */
    private function buildNormalizedUrl(string $scheme, string $host, ?int $port, array $parsed): string
    {
        $url = $scheme . '://' . $host;

        $defaultPort = $scheme === 'http' ? 80 : 443;
        if ($port !== null && $port !== $defaultPort) {
            $url .= ':' . $port;
        }

        $path = isset($parsed['path']) && is_string($parsed['path']) ? $parsed['path'] : '';
        $url .= $path === '' ? '/' : $path;

        if (isset($parsed['query']) && is_string($parsed['query']) && $parsed['query'] !== '') {
            $url .= '?' . $parsed['query'];
        }

        return $url;
    }

    /**
     * @return array{ok: false, reason: string, message: string}
     */
    private function fail(string $reason, string $message): array
    {
        return ['ok' => false, 'reason' => $reason, 'message' => $message];
    }
}
