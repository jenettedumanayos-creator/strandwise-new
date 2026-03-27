<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('GET');
$auth = require_auth();

$db = get_db_connection();

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
