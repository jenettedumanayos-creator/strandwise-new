<?php

function json_response(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
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
