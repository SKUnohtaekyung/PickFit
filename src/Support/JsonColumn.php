<?php

declare(strict_types=1);

namespace PickFit\Support;

final class JsonColumn
{
    /**
     * @return array<int|string, mixed>
     */
    public static function decode(mixed $value): array
    {
        if (!is_string($value) || $value === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }
}
