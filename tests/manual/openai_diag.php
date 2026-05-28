<?php

declare(strict_types=1);

/**
 * Diagnostic: bare curl GET to https://api.openai.com/v1/models with the user's
 * configured API key. The /v1/models endpoint is FREE (no token consumption).
 *
 * Prints:
 *   - PHP / curl / OpenSSL versions
 *   - DNS resolution result
 *   - HTTP status, curl errno, curl error string
 *   - First 300 chars of response body (sanitized)
 *   - Diagnosis hint
 *
 * Does NOT print the API key at any point.
 *
 * Usage: php tests/manual/openai_diag.php
 */

require __DIR__ . '/../../vendor/autoload.php';

use PickFit\Config;

$projectRoot = realpath(__DIR__ . '/../..');
$config = Config::fromEnvironment($projectRoot);

$apiKey = $config->openAiApiKey();
$model = $config->openAiModel();

if ($apiKey === null) {
    echo "ABORT: OPENAI_API_KEY missing in .env\n";
    exit(1);
}

echo '=== Environment ===' . PHP_EOL;
echo 'PHP version       : ' . PHP_VERSION . PHP_EOL;
$curlVer = curl_version();
echo 'curl version      : ' . ($curlVer['version'] ?? 'unknown') . PHP_EOL;
echo 'SSL version       : ' . ($curlVer['ssl_version'] ?? 'unknown') . PHP_EOL;
echo 'curl.cainfo       : ' . (ini_get('curl.cainfo') ?: '(empty)') . PHP_EOL;
echo 'openssl.cafile    : ' . (ini_get('openssl.cafile') ?: '(empty)') . PHP_EOL;
echo 'OPENAI_MODEL      : ' . ($model ?? '(missing)') . PHP_EOL;

echo PHP_EOL . '=== DNS check (api.openai.com) ===' . PHP_EOL;
$ips = @gethostbynamel('api.openai.com');
if ($ips === false || $ips === []) {
    echo 'DNS resolution    : FAIL — could not resolve api.openai.com' . PHP_EOL;
} else {
    echo 'DNS resolution    : OK — ' . implode(', ', $ips) . PHP_EOL;
}

echo PHP_EOL . '=== curl GET /v1/models ===' . PHP_EOL;

$ch = curl_init('https://api.openai.com/v1/models');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $apiKey,
        'Accept: application/json',
    ],
]);

$caCertPath = $projectRoot . '/storage/certs/cacert.pem';
$caCertUsed = false;
if (is_file($caCertPath)) {
    curl_setopt($ch, CURLOPT_CAINFO, $caCertPath);
    $caCertUsed = true;
}
echo 'CA bundle used    : ' . ($caCertUsed ? $caCertPath : '(none — system default)') . PHP_EOL;

$startedAt = microtime(true);
$raw = curl_exec($ch);
$elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);
$errno = curl_errno($ch);
$err = curl_error($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$info = curl_getinfo($ch);

echo 'Elapsed (ms)      : ' . $elapsedMs . PHP_EOL;
echo 'HTTP status       : ' . $status . PHP_EOL;
echo 'curl errno        : ' . $errno . PHP_EOL;
echo 'curl error        : ' . ($err === '' ? '(none)' : $err) . PHP_EOL;
echo 'Primary IP        : ' . ($info['primary_ip'] ?? '(none)') . PHP_EOL;
echo 'SSL verify result : ' . ($info['ssl_verify_result'] ?? 'n/a') . PHP_EOL;

if (is_string($raw) && $raw !== '') {
    $preview = mb_substr($raw, 0, 300);
    echo 'Body preview      : ' . str_replace(["\n", "\r"], ' ', $preview) . (mb_strlen($raw) > 300 ? '...' : '') . PHP_EOL;
} else {
    echo 'Body              : (empty)' . PHP_EOL;
}

echo PHP_EOL . '=== Diagnosis ===' . PHP_EOL;
if ($errno === 0 && $status === 200) {
    echo 'OK: connectivity + auth healthy. Model list reachable. If the recommendation' . PHP_EOL;
    echo 'smoke still falls back, the failure is in the /v1/responses request body or schema.' . PHP_EOL;
} elseif ($errno === 0 && $status === 401) {
    echo 'API key was rejected by OpenAI (401). Check the key in .env.' . PHP_EOL;
} elseif ($errno === 0 && $status === 429) {
    echo 'Rate limit / quota exceeded (429). Check OpenAI dashboard.' . PHP_EOL;
} elseif ($errno === 0 && $status >= 500) {
    echo 'OpenAI server-side error (' . $status . '). Transient — try again.' . PHP_EOL;
} elseif ($errno === 6) {
    echo 'CURLE_COULDNT_RESOLVE_HOST: DNS failure. Check network / DNS settings.' . PHP_EOL;
} elseif ($errno === 7) {
    echo 'CURLE_COULDNT_CONNECT: TCP block. Firewall or proxy?' . PHP_EOL;
} elseif ($errno === 28) {
    echo 'CURLE_OPERATION_TIMEDOUT: connection or read timeout. Slow network.' . PHP_EOL;
} elseif ($errno === 35 || $errno === 51 || $errno === 53 || $errno === 54) {
    echo 'TLS handshake failure (errno=' . $errno . '). Protocol/cipher mismatch — likely older PHP-libcurl build.' . PHP_EOL;
} elseif ($errno === 60 || $errno === 77) {
    echo 'CURLE_SSL_CACERT (errno=' . $errno . '): TLS certificate bundle missing or unreadable.' . PHP_EOL;
    echo 'FIX: Download cacert.pem from https://curl.se/ca/cacert.pem, save to e.g.' . PHP_EOL;
    echo '  C:\\Users\\miso\\tools\\frankenphp-1.12.0\\cacert.pem' . PHP_EOL;
    echo 'and add to php.ini:' . PHP_EOL;
    echo '  curl.cainfo="C:\\Users\\miso\\tools\\frankenphp-1.12.0\\cacert.pem"' . PHP_EOL;
    echo '  openssl.cafile="C:\\Users\\miso\\tools\\frankenphp-1.12.0\\cacert.pem"' . PHP_EOL;
} elseif ($errno !== 0) {
    echo 'Other curl error (errno=' . $errno . '). See message above.' . PHP_EOL;
} else {
    echo 'Unexpected HTTP status ' . $status . '. Inspect body preview.' . PHP_EOL;
}
