<?php

declare(strict_types=1);

namespace PickFit\Http;

final class Response
{
    /**
     * @param array<string, string> $headers
     */
    public function __construct(
        private readonly string $body,
        private readonly int $status = 200,
        private readonly array $headers = [],
    ) {
    }

    /**
     * @param mixed[] $payload
     */
    public static function json(array $payload, int $status = 200): self
    {
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return new self($body === false ? '{}' : $body, $status, [
            'Content-Type' => 'application/json; charset=UTF-8',
            'Cache-Control' => 'no-store',
        ]);
    }

    public static function file(string $path, string $contentType): self
    {
        if (!is_file($path)) {
            return self::json([
                'ok' => false,
                'error' => [
                    'code' => 'spa_entry_missing',
                    'message' => 'SPA entry file is missing.',
                ],
            ], 500);
        }

        $body = file_get_contents($path);

        return new self($body === false ? '' : $body, 200, [
            'Content-Type' => $contentType,
        ]);
    }

    public function send(): void
    {
        http_response_code($this->status);

        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }

        echo $this->body;
    }
}
