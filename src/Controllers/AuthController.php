<?php

declare(strict_types=1);

namespace PickFit\Controllers;

use InvalidArgumentException;
use PickFit\Http\Request;
use PickFit\Http\Response;
use PickFit\Services\AuthService;
use RuntimeException;

final class AuthController
{
    public function __construct(private readonly AuthService $auth)
    {
    }

    public function register(Request $request): Response
    {
        $data = $this->json($request);
        if ($data instanceof Response) {
            return $data;
        }

        try {
            $user = $this->auth->register(
                $this->stringValue($data, 'email'),
                $this->stringValue($data, 'password'),
                $this->optionalStringValue($data, 'displayName'),
            );
        } catch (InvalidArgumentException $exception) {
            return $this->validationError($exception->getMessage());
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() === 'Email is already registered.') {
                return $this->validationError('Email is already registered.');
            }

            throw $exception;
        }

        return $this->success([
            'user' => $user,
        ], 201);
    }

    public function login(Request $request): Response
    {
        $data = $this->json($request);
        if ($data instanceof Response) {
            return $data;
        }

        try {
            $user = $this->auth->login(
                $this->stringValue($data, 'email'),
                $this->stringValue($data, 'password'),
            );
        } catch (InvalidArgumentException $exception) {
            return $this->validationError($exception->getMessage());
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() === 'Invalid email or password.') {
                return $this->error('unauthenticated', 'Invalid email or password.', 401);
            }

            throw $exception;
        }

        return $this->success([
            'user' => $user,
        ]);
    }

    public function logout(): Response
    {
        $this->auth->logout();

        return $this->success([
            'loggedOut' => true,
        ]);
    }

    public function me(): Response
    {
        $user = $this->auth->currentUser();

        if ($user === null) {
            return $this->error('unauthenticated', 'Login required.', 401);
        }

        return $this->success([
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'displayName' => $user['displayName'] ?? null,
            ],
        ]);
    }

    /**
     * @return array<string, mixed>|Response
     */
    private function json(Request $request): array|Response
    {
        try {
            return $request->json();
        } catch (InvalidArgumentException) {
            return $this->validationError('Request body must be a JSON object.');
        }
    }

    /**
     * @param array<string, mixed> $data
     */
    private function stringValue(array $data, string $key): string
    {
        $value = $data[$key] ?? null;

        if (!is_string($value) || trim($value) === '') {
            throw new InvalidArgumentException($key . ' is required.');
        }

        return $value;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function optionalStringValue(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        if ($value === null) {
            return null;
        }

        if (!is_string($value)) {
            throw new InvalidArgumentException($key . ' must be a string.');
        }

        return $value;
    }

    private function validationError(string $message): Response
    {
        return $this->error('validation_failed', $message, 422);
    }

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
