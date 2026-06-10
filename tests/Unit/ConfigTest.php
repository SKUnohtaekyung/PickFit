<?php

declare(strict_types=1);

namespace PickFit\Tests\Unit;

use PHPUnit\Framework\TestCase;
use PickFit\Config;

final class ConfigTest extends TestCase
{
    private ?string $tempDir = null;

    protected function tearDown(): void
    {
        if ($this->tempDir !== null && is_dir($this->tempDir)) {
            @unlink($this->tempDir . DIRECTORY_SEPARATOR . '.env');
            @rmdir($this->tempDir);
        }
    }

    public function testEnvFileParserStripsInlineCommentsFromUnquotedValues(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pickfit-config-' . bin2hex(random_bytes(4));
        self::assertTrue(@mkdir($this->tempDir));

        file_put_contents(
            $this->tempDir . DIRECTORY_SEPARATOR . '.env',
            implode(PHP_EOL, [
                'PICKFIT_TEST_INLINE=value # local comment',
                'PICKFIT_TEST_QUOTED="value # kept"',
                'OPENAI_TIMEOUT_SECONDS=15 # seconds',
                'bad-key=ignored',
            ]),
        );

        $config = Config::fromEnvironment($this->tempDir);

        self::assertSame('value', $config->get('PICKFIT_TEST_INLINE'));
        self::assertSame('value # kept', $config->get('PICKFIT_TEST_QUOTED'));
        self::assertSame(15, $config->openAiTimeoutSeconds());
        self::assertNull($config->get('bad-key'));
    }
}
