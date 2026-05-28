<?php

declare(strict_types=1);

namespace PickFit\Support;

final class PublicId
{
    private const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    /**
     * 26-character Crockford-base32 ULID-style identifier: 10 timestamp chars + 16 random chars.
     */
    public static function generate(): string
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
}
