<?php

declare(strict_types=1);

namespace PickFit\Tests\Support;

/**
 * Lightweight HTTP client for Feature tests. Holds a per-instance cookie jar
 * (PHP session) and automatically injects the X-CSRF-Token header after
 * fetchCsrf() is called.
 *
 * Each Feature test should construct one client (fresh session) and call
 * destroy() in tearDown so the temp cookie file is removed.
 */
final class HttpClient
{
    private readonly string $cookieJar;
    private string $csrfToken = '';

    public function __construct(private readonly string $baseUrl = 'http://127.0.0.1:8002')
    {
        $this->cookieJar = sys_get_temp_dir()
            . DIRECTORY_SEPARATOR
            . 'pickfit-test-' . bin2hex(random_bytes(4)) . '.cookies';
    }

    /**
     * @return array{status: int, body: array<string, mixed>}
     */
    public function get(string $path): array
    {
        return $this->request('GET', $path, null);
    }

    /**
     * @param array<string, mixed>|null $body
     * @return array{status: int, body: array<string, mixed>}
     */
    public function post(string $path, ?array $body = null): array
    {
        return $this->request('POST', $path, $body);
    }

    /**
     * @return array{status: int, body: array<string, mixed>}
     */
    public function delete(string $path): array
    {
        return $this->request('DELETE', $path, null);
    }

    public function fetchCsrf(): string
    {
        $resp = $this->get('/api/csrf');
        $token = $resp['body']['data']['csrfToken'] ?? null;
        if (is_string($token) && $token !== '') {
            $this->csrfToken = $token;
        }
        return $this->csrfToken;
    }

    public function csrfToken(): string
    {
        return $this->csrfToken;
    }

    public function destroy(): void
    {
        if (is_file($this->cookieJar)) {
            @unlink($this->cookieJar);
        }
    }

    /**
     * @param array<string, mixed>|null $body
     * @return array{status: int, body: array<string, mixed>}
     */
    private function request(string $method, string $path, ?array $body): array
    {
        $ch = curl_init($this->baseUrl . $path);
        if ($ch === false) {
            return ['status' => 0, 'body' => []];
        }

        $headers = [
            'Accept: application/json',
            'Content-Type: application/json',
        ];
        if ($this->csrfToken !== '') {
            $headers[] = 'X-CSRF-Token: ' . $this->csrfToken;
        }

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_COOKIEJAR => $this->cookieJar,
            CURLOPT_COOKIEFILE => $this->cookieJar,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER => $headers,
        ]);

        if ($body !== null) {
            $encoded = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encoded !== false) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $encoded);
            }
        }

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if (!is_string($raw)) {
            return ['status' => $status, 'body' => []];
        }

        $decoded = json_decode($raw, true);

        return [
            'status' => $status,
            'body' => is_array($decoded) ? $decoded : [],
        ];
    }
}
