<?php

declare(strict_types=1);

namespace PickFit\Services;

use PickFit\Http\Request;

final class CsrfService
{
    private const SESSION_KEY = 'csrf_token';

    public function token(): string
    {
        $token = $_SESSION[self::SESSION_KEY] ?? null;

        if (is_string($token) && $token !== '') {
            return $token;
        }

        $token = bin2hex(random_bytes(32));
        $_SESSION[self::SESSION_KEY] = $token;

        return $token;
    }

    public function validateRequest(Request $request): bool
    {
        return $this->validate($request->header('X-CSRF-Token'));
    }

    private function validate(?string $candidate): bool
    {
        $token = $_SESSION[self::SESSION_KEY] ?? null;

        return is_string($token)
            && is_string($candidate)
            && $candidate !== ''
            && hash_equals($token, $candidate);
    }
}
