<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('POST');

$payload = read_json_body();

$email = strtolower(trim((string)($payload['email'] ?? '')));
$password = (string)($payload['password'] ?? '');
$roleHint = strtolower(trim((string)($payload['userType'] ?? '')));

if ($email === '' || $password === '') {
    json_response(422, [
        'success' => false,
        'message' => 'Email and password are required'
    ]);
}

$db = get_db_connection();

$stmt = $db->prepare('SELECT user_id, school_id, first_name, last_name, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user || !password_verify($password, (string)$user['password_hash'])) {
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

if ($roleHint !== '' && $roleHint !== strtolower((string)$user['role'])) {
    json_response(403, [
        'success' => false,
        'message' => 'Selected user type does not match account role'
    ]);
}

$stmt = $db->prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?');
$userId = (int)$user['user_id'];
$stmt->bind_param('i', $userId);
$stmt->execute();
$stmt->close();

session_regenerate_id(true);

$normalizedRole = strtolower((string)$user['role']);

$_SESSION['user_id'] = $userId;
$_SESSION['userId'] = $userId;
$_SESSION['role'] = $normalizedRole;
$_SESSION['userType'] = $normalizedRole;

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
