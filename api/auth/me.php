<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('GET');
$auth = require_auth();

$db = get_db_connection();

if (($auth['auth_source'] ?? '') === 'admins' && ($auth['admin_id'] ?? 0) > 0) {
    $adminId = (int)$auth['admin_id'];
    $stmt = $db->prepare('SELECT admin_id, first_name, last_name, email, role, status, permissions, created_at, last_login, last_ip, updated_at FROM admins WHERE admin_id = ? LIMIT 1');
    $stmt->bind_param('i', $adminId);
    $stmt->execute();
    $admin = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$admin) {
        json_response(404, [
            'success' => false,
            'message' => 'Admin not found'
        ]);
    }

    $actualAdminRole = strtolower((string)($admin['role'] ?? 'admin'));
    $admin['admin_role'] = $actualAdminRole;
    $admin['role'] = 'admin';

    json_response(200, [
        'success' => true,
        'message' => 'Session is valid',
        'data' => $admin
    ]);
}

$stmt = $db->prepare('SELECT u.user_id, u.first_name, u.last_name, u.email, u.role, u.status, u.created_at, u.last_login, s.school_id, s.school_name, st.student_id, st.grade_level FROM users u LEFT JOIN schools s ON s.school_id = u.school_id LEFT JOIN students st ON st.user_id = u.user_id WHERE u.user_id = ? LIMIT 1');
$stmt->bind_param('i', $auth['user_id']);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user) {
    json_response(404, [
        'success' => false,
        'message' => 'User not found'
    ]);
}

json_response(200, [
    'success' => true,
    'message' => 'Session is valid',
    'data' => $user
]);
