<?php
require_once __DIR__ . '/../bootstrap.php';

$auth = require_role('admin');
$db = get_db_connection();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

function find_or_create_school_id(mysqli $db, string $schoolName): int
{
    $stmt = $db->prepare('SELECT school_id FROM schools WHERE school_name = ? LIMIT 1');
    $stmt->bind_param('s', $schoolName);
    $stmt->execute();
    $school = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($school) {
        return (int)$school['school_id'];
    }

    $stmt = $db->prepare('INSERT INTO schools (school_name) VALUES (?)');
    $stmt->bind_param('s', $schoolName);
    $stmt->execute();
    $schoolId = (int)$db->insert_id;
    $stmt->close();

    return $schoolId;
}

function load_user_record(mysqli $db, int $userId): ?array
{
    $stmt = $db->prepare('SELECT u.user_id, u.email, u.first_name, u.last_name, u.role, u.status, u.created_at, s.school_name, st.student_id, st.grade_level FROM users u LEFT JOIN schools s ON s.school_id = u.school_id LEFT JOIN students st ON st.user_id = u.user_id WHERE u.user_id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $row ?: null;
}

if ($method === 'GET') {
    $userId = (int)($_GET['user_id'] ?? 0);

    if ($userId <= 0 && isset($_GET['student_id'])) {
        $studentId = (int)$_GET['student_id'];
        if ($studentId > 0) {
            $stmt = $db->prepare('SELECT user_id FROM students WHERE student_id = ? LIMIT 1');
            $stmt->bind_param('i', $studentId);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            $userId = (int)($row['user_id'] ?? 0);
        }
    }

    if ($userId <= 0) {
        json_response(422, [
            'success' => false,
            'message' => 'user_id is required'
        ]);
    }

    $user = load_user_record($db, $userId);
    if (!$user) {
        json_response(404, [
            'success' => false,
            'message' => 'User not found'
        ]);
    }

    json_response(200, [
        'success' => true,
        'message' => 'User loaded',
        'data' => $user
    ]);
}

if ($method === 'POST') {
    $payload = read_json_body();

    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $firstName = trim((string)($payload['first_name'] ?? ''));
    $lastName = trim((string)($payload['last_name'] ?? ''));
    $password = (string)($payload['password'] ?? '');
    $role = strtolower(trim((string)($payload['role'] ?? 'student')));
    $schoolName = trim((string)($payload['school'] ?? ''));
    $gradeLevel = normalize_grade((string)($payload['grade_level'] ?? ''));

    if ($email === '' || $firstName === '' || $lastName === '' || $password === '' || $schoolName === '') {
        json_response(422, [
            'success' => false,
            'message' => 'Missing required fields'
        ]);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(422, [
            'success' => false,
            'message' => 'Invalid email format'
        ]);
    }

    if (strlen($password) < 8) {
        json_response(422, [
            'success' => false,
            'message' => 'Password must be at least 8 characters'
        ]);
    }

    if (!in_array($role, ['student', 'admin', 'counselor'], true)) {
        json_response(422, [
            'success' => false,
            'message' => 'Invalid role'
        ]);
    }

    if ($role === 'student' && $gradeLevel === '') {
        json_response(422, [
            'success' => false,
            'message' => 'grade_level is required for student accounts'
        ]);
    }

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

        $schoolId = find_or_create_school_id($db, $schoolName);
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $status = 'active';

        $stmt = $db->prepare('INSERT INTO users (school_id, first_name, last_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('issssss', $schoolId, $firstName, $lastName, $email, $passwordHash, $role, $status);
        $stmt->execute();
        $newUserId = (int)$db->insert_id;
        $stmt->close();

        if ($role === 'student') {
            $stmt = $db->prepare('INSERT INTO students (user_id, first_name, last_name, grade_level) VALUES (?, ?, ?, ?)');
            $stmt->bind_param('isss', $newUserId, $firstName, $lastName, $gradeLevel);
            $stmt->execute();
            $stmt->close();
        }

        $db->commit();

        $createdUser = load_user_record($db, $newUserId);
        json_response(201, [
            'success' => true,
            'message' => 'User created successfully',
            'data' => $createdUser
        ]);
    } catch (Throwable $err) {
        $db->rollback();
        json_response(500, [
            'success' => false,
            'message' => 'Failed to create user',
            'error' => $err->getMessage()
        ]);
    }
}

if ($method === 'PUT' || $method === 'PATCH') {
    $payload = read_json_body();

    $userId = (int)($payload['user_id'] ?? 0);
    if ($userId <= 0 && isset($payload['student_id'])) {
        $studentId = (int)$payload['student_id'];
        if ($studentId > 0) {
            $stmt = $db->prepare('SELECT user_id FROM students WHERE student_id = ? LIMIT 1');
            $stmt->bind_param('i', $studentId);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            $userId = (int)($row['user_id'] ?? 0);
        }
    }

    if ($userId <= 0) {
        json_response(422, [
            'success' => false,
            'message' => 'user_id is required'
        ]);
    }

    $current = load_user_record($db, $userId);
    if (!$current) {
        json_response(404, [
            'success' => false,
            'message' => 'User not found'
        ]);
    }

    $firstName = trim((string)($payload['first_name'] ?? $current['first_name']));
    $lastName = trim((string)($payload['last_name'] ?? $current['last_name']));
    $email = strtolower(trim((string)($payload['email'] ?? $current['email'])));
    $status = strtolower(trim((string)($payload['status'] ?? $current['status'])));
    $schoolName = trim((string)($payload['school'] ?? $current['school_name'] ?? ''));
    $gradeLevel = normalize_grade((string)($payload['grade_level'] ?? ($current['grade_level'] ?? '')));

    if ($firstName === '' || $lastName === '' || $email === '' || $schoolName === '') {
        json_response(422, [
            'success' => false,
            'message' => 'first_name, last_name, email, and school are required'
        ]);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(422, [
            'success' => false,
            'message' => 'Invalid email format'
        ]);
    }

    if (!in_array($status, ['active', 'inactive'], true)) {
        json_response(422, [
            'success' => false,
            'message' => 'Invalid status'
        ]);
    }

    if (($current['role'] ?? '') === 'student' && $gradeLevel === '') {
        json_response(422, [
            'success' => false,
            'message' => 'grade_level is required for student accounts'
        ]);
    }

    try {
        $db->begin_transaction();

        $stmt = $db->prepare('SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1');
        $stmt->bind_param('si', $email, $userId);
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

        $schoolId = find_or_create_school_id($db, $schoolName);

        $stmt = $db->prepare('UPDATE users SET school_id = ?, first_name = ?, last_name = ?, email = ?, status = ? WHERE user_id = ?');
        $stmt->bind_param('issssi', $schoolId, $firstName, $lastName, $email, $status, $userId);
        $stmt->execute();
        $stmt->close();

        if (($current['role'] ?? '') === 'student') {
            $stmt = $db->prepare('UPDATE students SET first_name = ?, last_name = ?, grade_level = ? WHERE user_id = ?');
            $stmt->bind_param('sssi', $firstName, $lastName, $gradeLevel, $userId);
            $stmt->execute();
            $stmt->close();
        }

        $db->commit();

        $updated = load_user_record($db, $userId);
        json_response(200, [
            'success' => true,
            'message' => 'User updated successfully',
            'data' => $updated
        ]);
    } catch (Throwable $err) {
        $db->rollback();
        json_response(500, [
            'success' => false,
            'message' => 'Failed to update user',
            'error' => $err->getMessage()
        ]);
    }
}

if ($method === 'DELETE') {
    $payload = read_json_body();

    $userId = (int)($payload['user_id'] ?? ($_GET['user_id'] ?? 0));
    if ($userId <= 0) {
        $studentId = (int)($payload['student_id'] ?? ($_GET['student_id'] ?? 0));
        if ($studentId > 0) {
            $stmt = $db->prepare('SELECT user_id FROM students WHERE student_id = ? LIMIT 1');
            $stmt->bind_param('i', $studentId);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            $userId = (int)($row['user_id'] ?? 0);
        }
    }

    if ($userId <= 0) {
        json_response(422, [
            'success' => false,
            'message' => 'user_id is required'
        ]);
    }

    if ($userId === (int)$auth['user_id']) {
        json_response(422, [
            'success' => false,
            'message' => 'You cannot delete your own account'
        ]);
    }

    $current = load_user_record($db, $userId);
    if (!$current) {
        json_response(404, [
            'success' => false,
            'message' => 'User not found'
        ]);
    }

    $stmt = $db->prepare('DELETE FROM users WHERE user_id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if ($affected < 1) {
        json_response(500, [
            'success' => false,
            'message' => 'Failed to delete user'
        ]);
    }

    json_response(200, [
        'success' => true,
        'message' => 'User deleted successfully'
    ]);
}

json_response(405, [
    'success' => false,
    'message' => 'Method not allowed'
]);
