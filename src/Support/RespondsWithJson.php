<?php

declare(strict_types=1);

namespace PickFit\Support;

use PickFit\Http\Response;

// 컨트롤러 4곳에 중복돼 있던 표준 JSON 응답 봉투(success/error/meta)를 단일화.
// 출력 JSON 구조는 기존과 100% 동일하다(키 순서·meta 포맷 포함).
trait RespondsWithJson
{
    /**
     * @param array<string, mixed> $data
     */
    private function success(array $data, int $status = 200): Response
    {
        return Response::json([
            'ok' => true,
            'data' => $data,
            'meta' => $this->meta(),
        ], $status);
    }

    private function error(string $code, string $message, int $status): Response
    {
        return Response::json([
            'ok' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
            'meta' => $this->meta(),
        ], $status);
    }

    /**
     * @return array<string, string>
     */
    private function meta(): array
    {
        return [
            'requestId' => 'req_' . bin2hex(random_bytes(8)),
            'serverTime' => date(DATE_ATOM),
        ];
    }
}
