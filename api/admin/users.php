<?php
require_once '../bootstrap.php';

header('Content-Type: application/json');

// Only POST method allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['error' => 'Method not allowed']);
    exit;
}

list($user_id, $role) = require_auth();
require_role('admin');

$db = get_db_connection();
$payload = read_json_body();

// Validate required fields
$required = ['email', 'first_name', 'last_name', 'password', 'role', 'school', 'grade_level'];
foreach ($required as $field) {
    if (empty($payload[$field] ?? null)) {
        json_response(400, ['error' => "Missing required field: $field"]);
        exit;
    }
}

$email = trim($payload['email']);
$first_name = trim($payload['first_name']);
$last_name = trim($payload['last_name']);
$password = $payload['password'];
$role_to_create = strtolower(trim($payload['role']));
$school_name = trim($payload['school']);
$grade_level = trim($payload['grade_level']);

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(400, ['error' => 'Invalid email format']);
    exit;
}

// Validate password length
if (strlen($password) < 8) {
    json_response(400, ['error' => 'Password must be at least 8 characters']);
    exit;
}

// Validate role
if (!in_array($role_to_create, ['student', 'admin'])) {
    json_response(400, ['error' => 'Invalid role. Must be student or admin']);
    exit;
}

// Check for duplicate email
$stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    $stmt->close();
    json_response(409, ['error' => 'Email already exists']);
    exit;
}
$stmt->close();

// Start transaction
$db->begin_transaction();

try {
    // Find or create school
    $stmt = $db->prepare("SELECT id FROM schools WHERE name = ? LIMIT 1");
    $stmt->bind_param("s", $school_name);
    $stmt->execute();
    $school_result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($school_result) {
        $school_id = $school_result['id'];
    } else {
        $stmt = $db->prepare("INSERT INTO schools (name, region, created_at) VALUES (?, ?, NOW())");
        $region = 'Unknown'; // Default region
        $stmt->bind_param("ss", $school_name, $region);
        $stmt->execute();
        $school_id = $stmt->insert_id;
        $stmt->close();

        if ($school_id === 0) {
            throw new Exception('Failed to create school');
        }
    }

    // Hash password
    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    $account_status = 'active';

    // Insert user
    $stmt = $db->prepare(
        "INSERT INTO users (email, first_name, last_name, password_hash, role, school_id, account_status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
    );
    $stmt->bind_param("sssssis", $email, $first_name, $last_name, $password_hash, $role_to_create, $school_id, $account_status);
    $stmt->execute();
    $new_user_id = $stmt->insert_id;
    $stmt->close();

    if ($new_user_id === 0) {
        throw new Exception('Failed to create user');
    }

    // If student role, create student record
    if ($role_to_create === 'student') {
        $stmt = $db->prepare(
            "INSERT INTO students (user_id, school_id, grade_level, created_at) VALUES (?, ?, ?, NOW())"
        );
        $stmt->bind_param("iis", $new_user_id, $school_id, $grade_level);
        $stmt->execute();
        $stmt->close();
    }

    $db->commit();

    // Fetch created user
    $stmt = $db->prepare(
        "SELECT u.id, u.email, u.first_name, u.last_name, u.role, s.name as school_name, st.grade_level
         FROM users u
         LEFT JOIN schools s ON u.school_id = s.id
         LEFT JOIN students st ON u.id = st.user_id
         WHERE u.id = ?"
    );
    $stmt->bind_param("i", $new_user_id);
    $stmt->execute();
    $created_user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    json_response(201, [
        'success' => true,
        'message' => 'User created successfully',
        'user' => $created_user
    ]);

} catch (Exception $err) {
    $db->rollback();
    json_response(500, ['error' => 'Failed to create user: ' . $err->getMessage()]);
}
