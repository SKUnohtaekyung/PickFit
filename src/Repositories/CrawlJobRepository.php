<?php

declare(strict_types=1);

namespace PickFit\Repositories;

use PDO;
use PickFit\Support\JsonColumn;
use PickFit\Support\PublicId;

final class CrawlJobRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array{id: int, publicId: string}
     */
    public function createQueued(
        int $userId,
        string $inputUrl,
        string $normalizedUrl,
        string $sourceDomain,
        string $adapterName = 'generic',
    ): array {
        $publicId = PublicId::generate();
        $statement = $this->pdo->prepare(
            'INSERT INTO crawl_jobs
                (public_id, user_id, input_url, normalized_url, source_domain, status, adapter_name)
             VALUES (:publicId, :userId, :inputUrl, :normalizedUrl, :sourceDomain, :status, :adapterName)',
        );
        $statement->execute([
            'publicId' => $publicId,
            'userId' => $userId,
            'inputUrl' => $inputUrl,
            'normalizedUrl' => $normalizedUrl,
            'sourceDomain' => $sourceDomain,
            'status' => 'queued',
            'adapterName' => $adapterName,
        ]);

        return [
            'id' => (int) $this->pdo->lastInsertId(),
            'publicId' => $publicId,
        ];
    }

    public function markRunning(int $jobId): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE crawl_jobs SET status = :status, started_at = CURRENT_TIMESTAMP
             WHERE id = :id AND status = :prevStatus',
        );
        $statement->execute([
            'status' => 'running',
            'id' => $jobId,
            'prevStatus' => 'queued',
        ]);
    }

    /**
     * @param array<string, mixed> $rawResult
     */
    public function markSucceeded(
        int $jobId,
        array $rawResult,
        ?string $artifactDir,
        ?int $productId,
    ): void {
        $statement = $this->pdo->prepare(
            'UPDATE crawl_jobs
             SET status = :status,
                 raw_result_json = :rawResult,
                 artifact_dir = :artifactDir,
                 product_id = :productId,
                 error_code = NULL,
                 error_message = NULL,
                 finished_at = CURRENT_TIMESTAMP
             WHERE id = :id',
        );
        $statement->execute([
            'status' => 'succeeded',
            'rawResult' => json_encode($rawResult, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'artifactDir' => $artifactDir,
            'productId' => $productId,
            'id' => $jobId,
        ]);
    }

    public function markFailed(int $jobId, string $errorCode, string $errorMessage): void
    {
        $this->markTerminal($jobId, 'failed', $errorCode, $errorMessage);
    }

    public function markBlocked(int $jobId, string $errorCode, string $errorMessage): void
    {
        $this->markTerminal($jobId, 'blocked', $errorCode, $errorMessage);
    }

    /**
     * Find a crawl job owned by the given user. Returns null if the job does not exist
     * or belongs to another user (caller treats null as 404 without disclosing ownership).
     *
     * @return array<string, mixed>|null
     */
    public function findByPublicId(string $publicId, int $userId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT cj.id, cj.public_id, cj.user_id, cj.input_url, cj.normalized_url,
                    cj.source_domain, cj.status, cj.adapter_name, cj.error_code, cj.error_message,
                    cj.raw_result_json, cj.artifact_dir, cj.product_id, cj.started_at,
                    cj.finished_at, cj.created_at, cj.updated_at,
                    p.public_id AS product_public_id, p.product_name, p.brand_name,
                    p.price_sale, p.hero_image_url
             FROM crawl_jobs cj
             LEFT JOIN products p ON p.id = cj.product_id
             WHERE cj.public_id = :publicId AND cj.user_id = :userId
             LIMIT 1',
        );
        $statement->execute(['publicId' => $publicId, 'userId' => $userId]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            return null;
        }

        return $this->hydrate($row);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findInternalById(int $jobId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, public_id, user_id, input_url, normalized_url, source_domain, status,
                    adapter_name, error_code, error_message, raw_result_json, artifact_dir,
                    product_id, started_at, finished_at, created_at, updated_at
             FROM crawl_jobs WHERE id = :id LIMIT 1',
        );
        $statement->execute(['id' => $jobId]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            return null;
        }
        return $this->hydrate($row);
    }

    private function markTerminal(int $jobId, string $status, string $errorCode, string $errorMessage): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE crawl_jobs
             SET status = :status,
                 error_code = :errorCode,
                 error_message = :errorMessage,
                 finished_at = CURRENT_TIMESTAMP
             WHERE id = :id',
        );
        $statement->execute([
            'status' => $status,
            'errorCode' => $errorCode,
            // Cap error message at 1000 chars to prevent log overflow from large stderr blobs.
            'errorMessage' => mb_substr($errorMessage, 0, 1000),
            'id' => $jobId,
        ]);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function hydrate(array $row): array
    {
        $hydrated = [
            'id' => (int) $row['id'],
            'publicId' => (string) $row['public_id'],
            'userId' => (int) $row['user_id'],
            'inputUrl' => (string) $row['input_url'],
            'normalizedUrl' => (string) $row['normalized_url'],
            'sourceDomain' => (string) $row['source_domain'],
            'status' => (string) $row['status'],
            'adapterName' => (string) $row['adapter_name'],
            'errorCode' => $row['error_code'] === null ? null : (string) $row['error_code'],
            'errorMessage' => $row['error_message'] === null ? null : (string) $row['error_message'],
            'rawResult' => JsonColumn::decode($row['raw_result_json'] ?? null),
            'artifactDir' => $row['artifact_dir'] === null ? null : (string) $row['artifact_dir'],
            'productId' => isset($row['product_id']) && $row['product_id'] !== null ? (int) $row['product_id'] : null,
            'startedAt' => $row['started_at'] === null ? null : (string) $row['started_at'],
            'finishedAt' => $row['finished_at'] === null ? null : (string) $row['finished_at'],
            'createdAt' => (string) $row['created_at'],
            'updatedAt' => (string) $row['updated_at'],
        ];

        if (array_key_exists('product_public_id', $row) && $row['product_public_id'] !== null) {
            $hydrated['product'] = [
                'id' => (string) $row['product_public_id'],
                'productName' => (string) ($row['product_name'] ?? ''),
                'brandName' => $row['brand_name'] === null ? null : (string) $row['brand_name'],
                'priceSale' => $row['price_sale'] === null ? null : (int) $row['price_sale'],
                'heroImageUrl' => $row['hero_image_url'] === null ? null : (string) $row['hero_image_url'],
            ];
        } else {
            $hydrated['product'] = null;
        }

        return $hydrated;
    }
}
