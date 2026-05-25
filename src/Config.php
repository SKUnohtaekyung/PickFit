<?php

declare(strict_types=1);

namespace PickFit;

final class Config
{
    /**
     * @param array<string, string> $values
     */
    public function __construct(private readonly array $values)
    {
    }

    public static function fromEnvironment(?string $projectRoot = null): self
    {
        $defaults = [
            'APP_ENV' => 'local',
            'APP_URL' => 'http://127.0.0.1:8000',
            'APP_TIMEZONE' => 'Asia/Seoul',
            'SESSION_NAME' => 'pickfit_session',
            'SESSION_SECURE' => 'false',
            'DB_HOST' => '127.0.0.1',
            'DB_PORT' => '3306',
            'DB_DATABASE' => 'pickfit',
            'DB_USERNAME' => 'root',
            'DB_PASSWORD' => '',
        ];

        $envFileValues = $projectRoot === null ? [] : self::readEnvFile($projectRoot . DIRECTORY_SEPARATOR . '.env');
        $values = [];
        foreach ($defaults as $key => $default) {
            $value = getenv($key);
            $values[$key] = $value === false ? ($envFileValues[$key] ?? $default) : (string) $value;
        }

        return new self($values);
    }

    /**
     * @return array<string, string>
     */
    private static function readEnvFile(string $path): array
    {
        if (!is_file($path)) {
            return [];
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return [];
        }

        $values = [];
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $trimmed, 2);
            $values[trim($key)] = trim($value, " \t\n\r\0\x0B\"'");
        }

        return $values;
    }

    public function get(string $key, ?string $default = null): ?string
    {
        return $this->values[$key] ?? $default;
    }

    public function isLocal(): bool
    {
        return $this->get('APP_ENV') === 'local';
    }
}
