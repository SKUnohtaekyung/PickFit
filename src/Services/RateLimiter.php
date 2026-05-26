<?php

declare(strict_types=1);

namespace PickFit\Services;

final class RateLimiter
{
    public function __construct(
        private readonly string $storagePath,
        private readonly int $limit,
        private readonly int $windowSeconds,
    ) {
    }

    public function allow(string $key): bool
    {
        if ($this->limit < 1 || $this->windowSeconds < 1) {
            return true;
        }

        if (!is_dir($this->storagePath)) {
            mkdir($this->storagePath, 0775, true);
        }

        $path = $this->storagePath . DIRECTORY_SEPARATOR . hash('sha256', $key) . '.json';
        $handle = fopen($path, 'c+');
        if ($handle === false) {
            return true;
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                return true;
            }

            $contents = stream_get_contents($handle);
            $entry = is_string($contents) && $contents !== ''
                ? json_decode($contents, true)
                : null;

            $now = time();
            $windowStart = is_array($entry) && isset($entry['windowStart']) ? (int) $entry['windowStart'] : $now;
            $count = is_array($entry) && isset($entry['count']) ? (int) $entry['count'] : 0;

            if ($now >= $windowStart + $this->windowSeconds) {
                $windowStart = $now;
                $count = 0;
            }

            $count += 1;
            $allowed = $count <= $this->limit;

            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode([
                'windowStart' => $windowStart,
                'count' => $count,
                'updatedAt' => $now,
            ], JSON_UNESCAPED_SLASHES));
            fflush($handle);

            return $allowed;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}
