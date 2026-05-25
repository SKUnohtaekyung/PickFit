<?php

declare(strict_types=1);

use PickFit\Bootstrap;
use PickFit\Http\Request;
use PickFit\Http\Response;

$projectRoot = dirname(__DIR__);
$publicRoot = $projectRoot . DIRECTORY_SEPARATOR . 'public';
$composerAutoload = $projectRoot . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';

if (PHP_SAPI === 'cli-server') {
    $requestPath = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    $decodedPath = rawurldecode(is_string($requestPath) ? $requestPath : '/');
    $staticPath = realpath($publicRoot . DIRECTORY_SEPARATOR . ltrim($decodedPath, '/'));
    $publicRealPath = realpath($publicRoot);

    if (
        $staticPath !== false
        && $publicRealPath !== false
        && str_starts_with($staticPath, $publicRealPath . DIRECTORY_SEPARATOR)
        && is_file($staticPath)
    ) {
        return false;
    }
}

if (is_file($composerAutoload)) {
    require $composerAutoload;
} else {
    spl_autoload_register(static function (string $class) use ($projectRoot): void {
        $prefix = 'PickFit\\';
        if (!str_starts_with($class, $prefix)) {
            return;
        }

        $relativeClass = substr($class, strlen($prefix));
        $path = $projectRoot . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR
            . str_replace('\\', DIRECTORY_SEPARATOR, $relativeClass) . '.php';

        if (is_file($path)) {
            require $path;
        }
    });
}

try {
    Bootstrap::create($projectRoot)
        ->handle(Request::fromGlobals())
        ->send();
} catch (Throwable $exception) {
    Response::json([
        'ok' => false,
        'error' => [
            'code' => 'internal_error',
            'message' => 'Internal server error.',
        ],
    ], 500)->send();
}
