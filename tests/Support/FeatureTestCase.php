<?php

declare(strict_types=1);

namespace PickFit\Tests\Support;

use PDO;
use PHPUnit\Framework\TestCase;
use PickFit\Config;
use PickFit\Database;

/**
 * Base case for HTTP-level Feature tests. Spins up a fresh HttpClient (session
 * cookie jar) per test and cleans up any feature-test users it created in
 * tearDown. The actual PHP dev server must already be running at 127.0.0.1:8002.
 */
abstract class FeatureTestCase extends TestCase
{
    protected HttpClient $http;
    protected ?PDO $pdo = null;

    protected function setUp(): void
    {
        if (!$this->isServerUp()) {
            $this->markTestSkipped(
                'PHP dev server at 127.0.0.1:8002 is not responding. '
                . 'Start it with: php -S 127.0.0.1:8002 -t public public/index.php'
            );
        }
        $this->http = new HttpClient();
    }

    protected function tearDown(): void
    {
        if (isset($this->http)) {
            $this->http->destroy();
        }
        $this->cleanupFeatureTestUsers();
    }

    protected function pdo(): PDO
    {
        if ($this->pdo === null) {
            $projectRoot = realpath(__DIR__ . '/../..');
            $config = Config::fromEnvironment($projectRoot ?: __DIR__);
            $this->pdo = (new Database($config))->pdo();
        }
        return $this->pdo;
    }

    protected function uniqueEmail(string $prefix = 'feature-test'): string
    {
        return $prefix . '-' . bin2hex(random_bytes(4)) . '@test.local';
    }

    /**
     * @return array{email: string, password: string, csrf: string}
     */
    protected function registerAndLogin(string $emailPrefix = 'feature-test'): array
    {
        $email = $this->uniqueEmail($emailPrefix);
        $password = 'TestPass!23';
        $csrf = $this->http->fetchCsrf();
        $this->http->post('/api/auth/register', [
            'email' => $email,
            'password' => $password,
            'displayName' => 'Feature Test',
        ]);
        return ['email' => $email, 'password' => $password, 'csrf' => $csrf];
    }

    private function isServerUp(): bool
    {
        $ch = curl_init('http://127.0.0.1:8002/api/health');
        if ($ch === false) {
            return false;
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_TIMEOUT => 3,
        ]);
        $result = curl_exec($ch);
        $errno = curl_errno($ch);
        return $errno === 0 && is_string($result);
    }

    private function cleanupFeatureTestUsers(): void
    {
        try {
            $pdo = $this->pdo();
        } catch (\Throwable) {
            return;
        }
        try {
            $pdo->exec("DELETE FROM users WHERE email LIKE 'feature-test-%@test.local' OR email LIKE 'feature-test-auth-%@test.local'");
        } catch (\Throwable) {
            // best-effort cleanup; ignore if DB momentarily unavailable
        }
    }
}
