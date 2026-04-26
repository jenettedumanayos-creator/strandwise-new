<?php

function json_response(int $statusCode, array $payload): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    http_response_code($statusCode);

    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) {
        http_response_code(500);
        $json = '{"success":false,"message":"Failed to encode JSON response"}';
    }

    echo $json;
    exit;
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        json_response(405, [
            'success' => false,
            'message' => 'Method not allowed'
        ]);
    }
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_response(400, [
            'success' => false,
            'message' => 'Invalid JSON payload'
        ]);
    }

    return $data;
}

function normalize_grade(string $grade): string
{
    $g = strtolower(trim($grade));
    if ($g === '') {
        return '';
    }

    $map = [
        'grade9' => 'Grade 9',
        'grade10' => 'Grade 10',
        'grade11' => 'Grade 11',
        'grade12' => 'Grade 12'
    ];

    if (isset($map[$g])) {
        return $map[$g];
    }

    return ucwords($grade);
}

function require_auth(): array
{
    $sessionUserId = $_SESSION['user_id'] ?? ($_SESSION['userId'] ?? null);
    if (!$sessionUserId) {
        json_response(401, [
            'success' => false,
            'message' => 'Unauthorized'
        ]);
    }

    $sessionRole = $_SESSION['role'] ?? ($_SESSION['userType'] ?? '');
    $sessionAdminId = $_SESSION['admin_id'] ?? null;
    $sessionAuthSource = $_SESSION['auth_source'] ?? 'users';

    return [
        'user_id' => (int) $sessionUserId,
        'role' => strtolower((string) $sessionRole),
        'admin_id' => $sessionAdminId !== null ? (int) $sessionAdminId : null,
        'auth_source' => strtolower((string) $sessionAuthSource)
    ];
}

function require_role(string $requiredRole): array
{
    $auth = require_auth();
    if ($auth['role'] !== strtolower($requiredRole)) {
        json_response(403, [
            'success' => false,
            'message' => 'Forbidden'
        ]);
    }
    return $auth;
}

function ensure_admins_table(mysqli $db): void
{
    $db->query(
        'CREATE TABLE IF NOT EXISTS admins (
            admin_id INT AUTO_INCREMENT PRIMARY KEY,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT "admin",
            status VARCHAR(20) NOT NULL DEFAULT "active",
            permissions JSON NULL,
            last_login DATETIME NULL,
            last_ip VARCHAR(45) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by INT NULL,
            updated_at DATETIME NULL,
            CONSTRAINT fk_admins_created_by FOREIGN KEY (created_by) REFERENCES admins(admin_id)
                ON UPDATE CASCADE
                ON DELETE SET NULL,
            INDEX idx_admins_role (role),
            INDEX idx_admins_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

function ensure_default_admin(mysqli $db): void
{
    ensure_admins_table($db);

    $defaultEmail = strtolower((string) (defined('DEFAULT_ADMIN_EMAIL') ? DEFAULT_ADMIN_EMAIL : 'admin@gmail.com'));
    $defaultPassword = (string) (defined('DEFAULT_ADMIN_PASSWORD') ? DEFAULT_ADMIN_PASSWORD : 'administrator');
    $defaultFirstName = (string) (defined('DEFAULT_ADMIN_FIRST_NAME') ? DEFAULT_ADMIN_FIRST_NAME : 'System');
    $defaultLastName = (string) (defined('DEFAULT_ADMIN_LAST_NAME') ? DEFAULT_ADMIN_LAST_NAME : 'Admin');

    $passwordHash = password_hash($defaultPassword, PASSWORD_DEFAULT);

    $stmt = $db->prepare('INSERT INTO admins (first_name, last_name, email, password_hash, role, status, permissions, updated_at) VALUES (?, ?, ?, ?, "admin", "active", JSON_OBJECT("can_retrain_ai", true, "can_edit_strands", true, "can_manage_users", true), CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name), password_hash = VALUES(password_hash), role = "admin", status = "active", permissions = VALUES(permissions), updated_at = CURRENT_TIMESTAMP');
    $stmt->bind_param('ssss', $defaultFirstName, $defaultLastName, $defaultEmail, $passwordHash);
    $stmt->execute();
    $stmt->close();
}

function project_root_path(string $relativePath = ''): string
{
    $root = dirname(__DIR__);
    if ($relativePath === '') {
        return $root;
    }

    $relativePath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, ltrim($relativePath, '/\\'));
    return $root . DIRECTORY_SEPARATOR . $relativePath;
}

function rf_feature_names(): array
{
    return ['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'];
}

function rf_model_paths(): array
{
    return [
        'script' => project_root_path('ml/random_forest_classifier.py'),
        'model' => project_root_path('ml/random_forest_model.joblib'),
        'metadata' => project_root_path('ml/random_forest_metadata.json')
    ];
}

function rf_build_feature_vector(array $weightedScores): array
{
    $features = [];
    foreach (rf_feature_names() as $featureName) {
        $features[] = round((float)($weightedScores[$featureName] ?? 0.0), 4);
    }

    return $features;
}

function rf_collect_training_samples(mysqli $db): array
{
    $sql = 'SELECT r.recommendation_id, r.date_generated, r.explanation_text, s.strand_code
            FROM recommendations r
            INNER JOIN strands s ON s.strand_id = r.recommended_strand_id
            ORDER BY r.date_generated ASC, r.recommendation_id ASC';

    $result = $db->query($sql);
    if (!$result) {
        return [];
    }

    $samples = [];
    while ($row = $result->fetch_assoc()) {
        $parsed = json_decode((string)($row['explanation_text'] ?? ''), true);
        if (!is_array($parsed)) {
            continue;
        }

        $weightedScores = $parsed['weighted_scores'] ?? null;
        if (!is_array($weightedScores)) {
            continue;
        }

        $label = (string)($row['strand_code'] ?? '');
        if ($label === '') {
            continue;
        }

        $samples[] = [
            'id' => (int)($row['recommendation_id'] ?? 0),
            'label' => $label,
            'features' => rf_build_feature_vector($weightedScores),
            'generated_at' => $row['date_generated'] ?? null
        ];
    }

    return $samples;
}

function rf_flask_base_url(): string
{
    $envUrl = getenv('RF_FLASK_URL');
    if (is_string($envUrl) && trim($envUrl) !== '') {
        return rtrim(trim($envUrl), '/');
    }

    return 'http://127.0.0.1:5001';
}

function rf_run_via_flask(array $payload): array
{
    if (!function_exists('curl_init')) {
        return [
            'success' => false,
            'message' => 'cURL not available for Flask call.'
        ];
    }

    $action = strtolower((string)($payload['action'] ?? ''));
    $route = $action === 'predict' ? '/ml/predict' : '/ml/train';
    $url = rf_flask_base_url() . $route;

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($jsonPayload === false) {
        return [
            'success' => false,
            'message' => 'Failed to encode Flask payload.'
        ];
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
    curl_setopt($ch, CURLOPT_TIMEOUT, $action === 'predict' ? 8 : 90);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);

    $responseBody = curl_exec($ch);
    $curlErrNo = curl_errno($ch);
    $curlErr = curl_error($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($curlErrNo !== 0 || $responseBody === false) {
        return [
            'success' => false,
            'message' => 'Flask service unavailable: ' . ($curlErr !== '' ? $curlErr : 'connection failed')
        ];
    }

    $decoded = json_decode((string)$responseBody, true);
    if (!is_array($decoded)) {
        return [
            'success' => false,
            'message' => 'Flask returned non-JSON response.',
            'http_code' => $httpCode,
            'raw' => $responseBody
        ];
    }

    return $decoded;
}

function rf_run_local_python(array $payload): array
{
    $paths = rf_model_paths();
    if (!file_exists($paths['script'])) {
        return [
            'success' => false,
            'message' => 'Random Forest script not found.'
        ];
    }

    $python = project_root_path('.venv/Scripts/python.exe');
    if (!file_exists($python)) {
        return [
            'success' => false,
            'message' => 'Python executable not found.'
        ];
    }

    if (!function_exists('proc_open')) {
        return [
            'success' => false,
            'message' => 'proc_open is not available for Python execution.'
        ];
    }

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w']
    ];

    $process = proc_open(
        escapeshellarg($python) . ' ' . escapeshellarg($paths['script']),
        $descriptors,
        $pipes,
        project_root_path()
    );

    if (!is_resource($process)) {
        return [
            'success' => false,
            'message' => 'Unable to start Python process.'
        ];
    }

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($jsonPayload === false) {
        fclose($pipes[0]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);
        return [
            'success' => false,
            'message' => 'Failed to encode Python payload.'
        ];
    }

    fwrite($pipes[0], $jsonPayload);
    fclose($pipes[0]);

    $stdout = stream_get_contents($pipes[1]);
    fclose($pipes[1]);

    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[2]);

    $exitCode = proc_close($process);
    $decoded = json_decode((string)$stdout, true);

    if ($exitCode !== 0 || !is_array($decoded)) {
        return [
            'success' => false,
            'message' => trim($stderr) !== '' ? trim($stderr) : 'Python execution failed.',
            'stdout' => $stdout,
            'stderr' => $stderr,
            'exit_code' => $exitCode
        ];
    }

    return $decoded;
}

function rf_run_python(array $payload): array
{
    $flaskResult = rf_run_via_flask($payload);
    if (($flaskResult['success'] ?? false) === true) {
        return $flaskResult;
    }

    // Flask is optional at runtime; fallback keeps existing behavior working.
    return rf_run_local_python($payload);
}
