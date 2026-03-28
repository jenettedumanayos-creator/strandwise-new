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
        'user_id' => (int)$sessionUserId,
        'role' => strtolower((string)$sessionRole),
        'admin_id' => $sessionAdminId !== null ? (int)$sessionAdminId : null,
        'auth_source' => strtolower((string)$sessionAuthSource)
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
