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

        foreach ($envFileValues as $key => $value) {
            if (array_key_exists($key, $values)) {
                continue;
            }
            $processValue = getenv($key);
            $values[$key] = $processValue === false ? (string) $value : (string) $processValue;
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
            $key = trim($key);
            if (preg_match('/^[A-Z0-9_]+$/', $key) !== 1) {
                continue;
            }
            $values[$key] = self::parseEnvValue($value);
        }

        return $values;
    }

    private static function parseEnvValue(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        $first = $value[0];
        if (($first === '"' || $first === "'") && str_ends_with($value, $first)) {
            return substr($value, 1, -1);
        }

        $value = preg_replace('/\s+#.*$/', '', $value) ?? $value;
        return trim($value, " \t\n\r\0\x0B\"'");
    }

    public function get(string $key, ?string $default = null): ?string
    {
        return $this->values[$key] ?? $default;
    }

    public function isLocal(): bool
    {
        return $this->get('APP_ENV') === 'local';
    }

    public function openAiApiKey(): ?string
    {
        $value = $this->get('OPENAI_API_KEY');
        return $value === null || $value === '' ? null : $value;
    }

    public function openAiModel(): ?string
    {
        $value = $this->get('OPENAI_MODEL');
        return $value === null || $value === '' ? null : $value;
    }

    public function openAiTimeoutSeconds(): int
    {
        $value = $this->get('OPENAI_TIMEOUT_SECONDS', '60') ?? '60';
        $parsed = (int) $value;
        return $parsed > 0 ? $parsed : 60;
    }

    public function openAiExtractionEnabled(): bool
    {
        $value = $this->get('OPENAI_EXTRACTION_ENABLED', 'false') ?? 'false';
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * 추천 응답 다양성 제어용 temperature. 미설정이면 null → 요청 바디에서 키를 생략해
     * temperature 를 거부하는 모델에서도 400 이 나지 않는다(옵트인).
     */
    public function openAiTemperature(): ?float
    {
        $value = $this->get('OPENAI_TEMPERATURE');
        return $value === null || $value === '' ? null : (float) $value;
    }

    /**
     * 동일 입력 재현성용 seed(지원 모델 한정). 미설정이면 null → 키 생략.
     */
    public function openAiSeed(): ?int
    {
        $value = $this->get('OPENAI_SEED');
        return $value === null || $value === '' ? null : (int) $value;
    }
}
