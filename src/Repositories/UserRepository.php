<?php

declare(strict_types=1);

namespace PickFit\Repositories;

use PDO;
use PDOException;

final class UserRepository
{
    private const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function create(string $email, string $passwordHash, ?string $displayName): array
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $publicId = self::generatePublicId();

            try {
                $statement = $this->pdo->prepare(
                    'INSERT INTO users (public_id, email, password_hash, display_name)
                     VALUES (:publicId, :email, :passwordHash, :displayName)',
                );
                $statement->execute([
                    'publicId' => $publicId,
                    'email' => $email,
                    'passwordHash' => $passwordHash,
                    'displayName' => $displayName,
                ]);

                $user = $this->findAuthRecordByEmail($email);
                if ($user !== null) {
                    return $user;
                }
            } catch (PDOException $exception) {
                if ($exception->getCode() !== '23000') {
                    throw $exception;
                }

                if ($this->findAuthRecordByEmail($email) !== null) {
                    throw $exception;
                }
            }
        }

        throw new PDOException('Unable to create a unique user record.');
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findAuthRecordByEmail(string $email): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, public_id, email, password_hash, display_name, role, last_login_at, created_at, updated_at
             FROM users WHERE email = :email LIMIT 1',
        );
        $statement->execute(['email' => $email]);
        $row = $statement->fetch();

        return is_array($row) ? $this->toAuthRecord($row) : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByPublicId(string $publicId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, public_id, email, display_name, role, last_login_at, created_at, updated_at
             FROM users WHERE public_id = :publicId LIMIT 1',
        );
        $statement->execute(['publicId' => $publicId]);
        $row = $statement->fetch();

        return is_array($row) ? $this->toPublicRecord($row) : null;
    }

    public function touchLastLogin(int $id): void
    {
        $statement = $this->pdo->prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id');
        $statement->execute(['id' => $id]);
    }

    private static function generatePublicId(): string
    {
        $alphabet = self::CROCKFORD_BASE32;
        $time = (int) floor(microtime(true) * 1000);
        $timeChars = '';

        for ($index = 0; $index < 10; $index++) {
            $timeChars = $alphabet[$time % 32] . $timeChars;
            $time = intdiv($time, 32);
        }

        $randomBits = '';
        foreach (str_split(random_bytes(10)) as $byte) {
            $randomBits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $randomChars = '';
        for ($index = 0; $index < 16; $index++) {
            $randomChars .= $alphabet[bindec(substr($randomBits, $index * 5, 5))];
        }

        return $timeChars . $randomChars;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function toAuthRecord(array $row): array
    {
        return array_merge($this->toPublicRecord($row), [
            'passwordHash' => (string) $row['password_hash'],
        ]);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function toPublicRecord(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'publicId' => (string) $row['public_id'],
            'email' => (string) $row['email'],
            'displayName' => $row['display_name'] === null ? null : (string) $row['display_name'],
            'role' => (string) $row['role'],
            'lastLoginAt' => $row['last_login_at'] === null ? null : (string) $row['last_login_at'],
            'createdAt' => (string) $row['created_at'],
            'updatedAt' => (string) $row['updated_at'],
        ];
    }
}
