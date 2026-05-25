<?php

declare(strict_types=1);

namespace PickFit;

use PDO;

final class Database
{
    private ?PDO $pdo = null;

    public function __construct(private readonly Config $config)
    {
    }

    public function pdo(): PDO
    {
        if ($this->pdo instanceof PDO) {
            return $this->pdo;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $this->config->get('DB_HOST', '127.0.0.1'),
            $this->config->get('DB_PORT', '3306'),
            $this->config->get('DB_DATABASE', 'pickfit'),
        );

        $this->pdo = new PDO(
            $dsn,
            $this->config->get('DB_USERNAME', 'root'),
            $this->config->get('DB_PASSWORD', ''),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ],
        );

        return $this->pdo;
    }
}
