<?php

declare(strict_types=1);

namespace PickFit\Http;

use InvalidArgumentException;

final class Request
{
    /**
     * @param array<string, string> $headers
     */
    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly string $uri,
        private readonly string $body = '',
        private readonly array $headers = [],
        private readonly string $clientIp = '127.0.0.1',
    ) {
    }

    public static function fromGlobals(): self
    {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($uri, PHP_URL_PATH);
        $body = file_get_contents('php://input');

        return new self(
            $method,
            $path === false || $path === null ? '/' : $path,
            $uri,
            $body === false ? '' : $body,
            self::headersFromGlobals(),
            self::clientIpFromGlobals(),
        );
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function uri(): string
    {
        return $this->uri;
    }

    public function query(string $key, ?string $default = null): ?string
    {
        $value = $_GET[$key] ?? null;

        return is_scalar($value) ? (string) $value : $default;
    }

    public function body(): string
    {
        return $this->body;
    }

    public function header(string $name, ?string $default = null): ?string
    {
        $normalizedName = self::normalizeHeaderName($name);

        if (isset($this->headers[$normalizedName])) {
            return $this->headers[$normalizedName];
        }

        foreach ($this->headers as $headerName => $value) {
            if (self::normalizeHeaderName((string) $headerName) === $normalizedName) {
                return $value;
            }
        }

        return $default;
    }

    public function clientIp(): string
    {
        return $this->clientIp;
    }

    /**
     * @return array<string, mixed>
     */
    public function json(): array
    {
        $body = preg_replace('/^\xEF\xBB\xBF/', '', $this->body) ?? $this->body;

        if (trim($body) === '') {
            return [];
        }

        $decoded = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded) || array_is_list($decoded)) {
            throw new InvalidArgumentException('Invalid JSON request body.');
        }

        return $decoded;
    }

    /**
     * @return array<string, string>
     */
    private static function headersFromGlobals(): array
    {
        $headers = [];

        foreach ($_SERVER as $key => $value) {
            if (!is_scalar($value)) {
                continue;
            }

            if (str_starts_with($key, 'HTTP_')) {
                $name = substr($key, 5);
            } elseif ($key === 'CONTENT_TYPE' || $key === 'CONTENT_LENGTH') {
                $name = $key;
            } else {
                continue;
            }

            $headers[self::normalizeHeaderName($name)] = (string) $value;
        }

        return $headers;
    }

    private static function normalizeHeaderName(string $name): string
    {
        return strtolower(str_replace('_', '-', $name));
    }

    private static function clientIpFromGlobals(): string
    {
        $remoteAddress = $_SERVER['REMOTE_ADDR'] ?? null;

        return is_string($remoteAddress) && filter_var($remoteAddress, FILTER_VALIDATE_IP) !== false
            ? $remoteAddress
            : '127.0.0.1';
    }
}
