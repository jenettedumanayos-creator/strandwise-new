<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('GET');
require_role('admin');

$baseUrl = getenv('RF_FLASK_URL');
if (!is_string($baseUrl) || trim($baseUrl) === '') {
    $baseUrl = 'http://127.0.0.1:5001';
}
$healthUrl = rtrim(trim($baseUrl), '/') . '/ml/health';

if (!function_exists('curl_init')) {
    json_response(200, [
        'success' => true,
        'connected' => false,
        'service' => 'flask-ml',
        'message' => 'cURL extension is unavailable.',
        'url' => $healthUrl
    ]);
}

$ch = curl_init($healthUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 4);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
$raw = curl_exec($ch);
$errno = curl_errno($ch);
$error = curl_error($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

if ($errno !== 0 || $raw === false) {
    json_response(200, [
        'success' => true,
        'connected' => false,
        'service' => 'flask-ml',
        'message' => 'Flask service unavailable: ' . ($error !== '' ? $error : 'connection failed'),
        'url' => $healthUrl,
        'http_code' => $httpCode
    ]);
}

$decoded = json_decode((string)$raw, true);
if (!is_array($decoded)) {
    json_response(200, [
        'success' => true,
        'connected' => false,
        'service' => 'flask-ml',
        'message' => 'Invalid JSON response from Flask service.',
        'url' => $healthUrl,
        'http_code' => $httpCode
    ]);
}

$connected = $httpCode >= 200 && $httpCode < 300 && (($decoded['success'] ?? false) === true);
json_response(200, [
    'success' => true,
    'connected' => $connected,
    'service' => 'flask-ml',
    'message' => $connected ? 'Flask ML service is reachable.' : 'Flask ML service returned an unhealthy response.',
    'url' => $healthUrl,
    'http_code' => $httpCode,
    'data' => $decoded
]);
