<?php

declare(strict_types=1);

namespace PickFit\Services;

use InvalidArgumentException;
use PDOException;
use PickFit\Repositories\UserRepository;
use LogicException;
use RuntimeException;

final class AuthService
{
    private const SESSION_KEY = 'auth_user';
    private const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

    public function __construct(private readonly ?UserRepository $users = null)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function register(string $email, string $password, ?string $displayName): array
    {
        $email = $this->normalizeEmail($email);
        $displayName = $this->normalizeDisplayName($displayName);

        if (strlen($password) < 8) {
            throw new InvalidArgumentException('Password must be at least 8 characters.');
        }

        $users = $this->users();

        if ($users->findAuthRecordByEmail($email) !== null) {
            throw new RuntimeException('Email is already registered.');
        }

        try {
            $user = $users->create($email, password_hash($password, PASSWORD_DEFAULT), $displayName);
        } catch (PDOException $exception) {
            if ($exception->getCode() !== '23000') {
                throw $exception;
            }

            throw new RuntimeException('Email is already registered.', 0, $exception);
        }

        $this->startAuthenticatedSession($user);

        return $this->toPublicUser($user);
    }

    /**
     * @return array<string, mixed>
     */
    public function login(string $email, string $password): array
    {
        $email = $this->normalizeLoginEmail($email);
        $user = $this->users()->findAuthRecordByEmail($email);

        if ($user === null || !password_verify($password, (string) $user['passwordHash'])) {
            throw new RuntimeException(self::GENERIC_LOGIN_ERROR);
        }

        $this->users()->touchLastLogin((int) $user['id']);
        $this->startAuthenticatedSession($user);

        return $this->toPublicUser($user);
    }

    public function logout(): void
    {
        $this->ensureSessionStarted();
        $_SESSION = [];

        if (ini_get('session.use_cookies') && !headers_sent()) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }

        session_destroy();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function currentUser(): ?array
    {
        $sessionUser = $_SESSION[self::SESSION_KEY] ?? null;

        return is_array($sessionUser) ? $sessionUser : null;
    }

    /**
     * @param array<string, mixed> $user
     */
    private function startAuthenticatedSession(array $user): void
    {
        $this->ensureSessionStarted();
        session_regenerate_id(true);
        $_SESSION[self::SESSION_KEY] = $this->toSessionUser($user);
    }

    private function ensureSessionStarted(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
    }

    private function users(): UserRepository
    {
        if ($this->users === null) {
            throw new LogicException('User repository is required for this auth operation.');
        }

        return $this->users;
    }

    private function normalizeEmail(string $email): string
    {
        $email = strtolower(trim($email));

        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('Email address is invalid.');
        }

        return $email;
    }

    private function normalizeLoginEmail(string $email): string
    {
        $email = strtolower(trim($email));

        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new RuntimeException(self::GENERIC_LOGIN_ERROR);
        }

        return $email;
    }

    private function normalizeDisplayName(?string $displayName): ?string
    {
        if ($displayName === null) {
            return null;
        }

        $displayName = trim($displayName);
        if ($displayName === '') {
            return null;
        }

        if (function_exists('mb_substr')) {
            return mb_substr($displayName, 0, 80, 'UTF-8');
        }

        return substr($displayName, 0, 80);
    }

    /**
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    private function toSessionUser(array $user): array
    {
        return [
            'userId' => (int) $user['id'],
            'id' => (string) $user['publicId'],
            'email' => (string) $user['email'],
            'displayName' => $user['displayName'] ?? null,
            'role' => (string) $user['role'],
        ];
    }

    /**
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    private function toPublicUser(array $user): array
    {
        return [
            'id' => (string) $user['publicId'],
            'email' => (string) $user['email'],
            'displayName' => $user['displayName'] ?? null,
        ];
    }
}
