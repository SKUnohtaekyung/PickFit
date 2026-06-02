<?php

declare(strict_types=1);

namespace PickFit\Http;

final class Response
{
    // 모든 응답에 적용하는 심층 방어용 보안 헤더(응답별 헤더가 같은 키를 지정하면 그쪽 우선).
    // SAMEORIGIN: 동일 출처 프레임은 허용(프리뷰 등)하되 외부 클릭재킹은 차단.
    private const SECURITY_HEADERS = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'SAMEORIGIN',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
    ];

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

        // 공통 보안 헤더 먼저 — 단, 응답별 헤더에 같은 키가 있으면 그 값을 우선한다.
        foreach (self::SECURITY_HEADERS as $name => $value) {
            if (!array_key_exists($name, $this->headers)) {
                header($name . ': ' . $value);
            }
        }

        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }

        echo $this->body;
    }
}
