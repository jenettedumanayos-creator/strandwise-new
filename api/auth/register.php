<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('POST');

$payload = read_json_body();

$firstName = trim((string)($payload['firstName'] ?? ''));
$lastName = trim((string)($payload['lastName'] ?? ''));
$email = strtolower(trim((string)($payload['email'] ?? '')));
$password = (string)($payload['password'] ?? '');
$schoolName = trim((string)($payload['school'] ?? ''));
$gradeLevel = normalize_grade((string)($payload['grade'] ?? ''));
$role = strtolower(trim((string)($payload['userType'] ?? 'student')));

if ($firstName === '' || $lastName === '' || $email === '' || $password === '' || $schoolName === '' || $gradeLevel === '') {
    json_response(422, [
        'success' => false,
        'message' => 'Missing required fields'
    ]);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(422, [
        'success' => false,
        'message' => 'Invalid email address'
    ]);
}

if (strlen($password) < 8) {
    json_response(422, [
        'success' => false,
        'message' => 'Password must be at least 8 characters'
    ]);
}

if (!in_array($role, ['student', 'counselor'], true)) {
    $role = 'student';
}

$db = get_db_connection();

try {
    $db->begin_transaction();

    $stmt = $db->prepare('SELECT user_id FROM users WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $existing = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($existing) {
        $db->rollback();
        json_response(409, [
            'success' => false,
            'message' => 'Email already exists'
        ]);
    }

    $schoolId = null;
    $stmt = $db->prepare('SELECT school_id FROM schools WHERE school_name = ? LIMIT 1');
    $stmt->bind_param('s', $schoolName);
    $stmt->execute();
    $school = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($school) {
        $schoolId = (int)$school['school_id'];
    } else {
        $stmt = $db->prepare('INSERT INTO schools (school_name) VALUES (?)');
        $stmt->bind_param('s', $schoolName);
        $stmt->execute();
        $schoolId = (int)$db->insert_id;
        $stmt->close();
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $db->prepare('INSERT INTO users (school_id, first_name, last_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, "active")');
    $stmt->bind_param('isssss', $schoolId, $firstName, $lastName, $email, $passwordHash, $role);
    $stmt->execute();
    $userId = (int)$db->insert_id;
    $stmt->close();

    if ($role === 'student') {
        $stmt = $db->prepare('INSERT INTO students (user_id, first_name, last_name, grade_level) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('isss', $userId, $firstName, $lastName, $gradeLevel);
        $stmt->execute();
        $stmt->close();
    }

    $db->commit();

    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['userId'] = $userId;
    $_SESSION['admin_id'] = null;
    $_SESSION['role'] = strtolower($role);
    $_SESSION['userType'] = strtolower($role);
    $_SESSION['admin_role'] = null;
    $_SESSION['auth_source'] = 'users';

    json_response(201, [
        'success' => true,
        'message' => 'Registration successful',
        'data' => [
            'user_id' => $userId,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'role' => $role,
            'school_name' => $schoolName,
            'grade_level' => $gradeLevel
        ]
    ]);
} catch (Throwable $e) {
    if ($db->errno) {
        $db->rollback();
    }

    json_response(500, [
        'success' => false,
        'message' => 'Failed to register user',
        'error' => $e->getMessage()
    ]);
}
