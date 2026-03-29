<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('POST');

$payload = read_json_body();

$email = strtolower(trim((string) ($payload['email'] ?? '')));
$password = (string) ($payload['password'] ?? '');
$roleHint = strtolower(trim((string) ($payload['userType'] ?? '')));

if ($email === '' || $password === '') {
    json_response(422, [
        'success' => false,
        'message' => 'Email and password are required'
    ]);
}

$db = get_db_connection();
try {
    if ($roleHint === 'admin') {
        $defaultAdminEmail = strtolower((string) (defined('DEFAULT_ADMIN_EMAIL') ? DEFAULT_ADMIN_EMAIL : 'admin@gmail.com'));
        if ($email === $defaultAdminEmail) {
            ensure_default_admin($db);
        }

        $stmt = $db->prepare('SELECT admin_id, first_name, last_name, email, password_hash, role, status FROM admins WHERE email = ? LIMIT 1');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $admin = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$admin || !password_verify($password, (string) $admin['password_hash'])) {
            json_response(401, [
                'success' => false,
                'message' => 'Invalid credentials'
            ]);
        }

        if (($admin['status'] ?? 'active') !== 'active') {
            json_response(403, [
                'success' => false,
                'message' => 'Admin account is inactive'
            ]);
        }

        $adminId = (int) $admin['admin_id'];
        $ipAddress = substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
        $stmt = $db->prepare('UPDATE admins SET last_login = CURRENT_TIMESTAMP, last_ip = ?, updated_at = CURRENT_TIMESTAMP WHERE admin_id = ?');
        $stmt->bind_param('si', $ipAddress, $adminId);
        $stmt->execute();
        $stmt->close();

        session_regenerate_id(true);

        $_SESSION['user_id'] = -$adminId;
        $_SESSION['userId'] = -$adminId;
        $_SESSION['admin_id'] = $adminId;
        $_SESSION['role'] = 'admin';
        $_SESSION['userType'] = 'admin';
        $_SESSION['admin_role'] = strtolower((string) ($admin['role'] ?? 'admin'));
        $_SESSION['auth_source'] = 'admins';

        json_response(200, [
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user_id' => -$adminId,
                'admin_id' => $adminId,
                'first_name' => $admin['first_name'],
                'last_name' => $admin['last_name'],
                'email' => $admin['email'],
                'role' => 'admin',
                'admin_role' => strtolower((string) ($admin['role'] ?? 'admin')),
                'redirect' => 'admin.html'
            ]
        ]);
    }

    $stmt = $db->prepare('SELECT user_id, school_id, first_name, last_name, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        json_response(401, [
            'success' => false,
            'message' => 'Invalid credentials'
        ]);
    }

    if (($user['status'] ?? 'active') !== 'active') {
        json_response(403, [
            'success' => false,
            'message' => 'User account is inactive'
        ]);
    }

    if ($roleHint !== '' && $roleHint !== strtolower((string) $user['role'])) {
        json_response(403, [
            'success' => false,
            'message' => 'Selected user type does not match account role'
        ]);
    }

    $stmt = $db->prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?');
    $userId = (int) $user['user_id'];
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $stmt->close();

    session_regenerate_id(true);

    $normalizedRole = strtolower((string) $user['role']);

    $_SESSION['user_id'] = $userId;
    $_SESSION['userId'] = $userId;
    $_SESSION['admin_id'] = null;
    $_SESSION['role'] = $normalizedRole;
    $_SESSION['userType'] = $normalizedRole;
    $_SESSION['admin_role'] = null;
    $_SESSION['auth_source'] = 'users';

    $redirect = ($normalizedRole === 'admin') ? 'admin.html' : 'main.html';

    json_response(200, [
        'success' => true,
        'message' => 'Login successful',
        'data' => [
            'user_id' => $userId,
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'],
            'role' => $normalizedRole,
            'school_id' => $user['school_id'],
            'redirect' => $redirect
        ]
    ]);
} catch (Throwable $err) {
    json_response(500, [
        'success' => false,
        'message' => 'Unable to process login at the moment'
    ]);
}
