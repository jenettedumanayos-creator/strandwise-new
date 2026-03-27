<?php
require_once '../bootstrap.php';

header('Content-Type: application/json');

// Only POST method allowed for creation
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['error' => 'Method not allowed']);
    exit;
}

list($user_id, $role) = require_auth();
require_role('admin');

$db = get_db_connection();
$payload = read_json_body();

// Validate required fields
$required_fields = ['name', 'description', 'total_questions'];
foreach ($required_fields as $field) {
    if (empty($payload[$field] ?? null)) {
        json_response(400, ['error' => "Missing required field: $field"]);
        exit;
    }
}

$name = trim($payload['name']);
$description = trim($payload['description']);
$total_questions = (int) $payload['total_questions'];

// Validate inputs
if (strlen($name) < 3) {
    json_response(400, ['error' => 'Assessment name must be at least 3 characters']);
    exit;
}

if (strlen($description) < 10) {
    json_response(400, ['error' => 'Assessment description must be at least 10 characters']);
    exit;
}

if ($total_questions < 1 || $total_questions > 100) {
    json_response(400, ['error' => 'Total questions must be between 1 and 100']);
    exit;
}

// Check for duplicate name
$stmt = $db->prepare("SELECT id FROM assessments WHERE name = ?");
$stmt->bind_param("s", $name);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    $stmt->close();
    json_response(409, ['error' => 'An assessment with this name already exists']);
    exit;
}
$stmt->close();

// Insert assessment
$stmt = $db->prepare(
    "INSERT INTO assessments (name, description, total_questions, created_by, created_at, updated_at) 
     VALUES (?, ?, ?, ?, NOW(), NOW())"
);
$stmt->bind_param("ssii", $name, $description, $total_questions, $user_id);
$stmt->execute();
$assessment_id = $stmt->insert_id;
$stmt->close();

if ($assessment_id === 0) {
    json_response(500, ['error' => 'Failed to create assessment']);
    exit;
}

// Fetch created assessment
$stmt = $db->prepare(
    "SELECT id, name, description, total_questions, created_by, created_at, updated_at FROM assessments WHERE id = ?"
);
$stmt->bind_param("i", $assessment_id);
$stmt->execute();
$created_assessment = $stmt->get_result()->fetch_assoc();
$stmt->close();

json_response(201, [
    'success' => true,
    'message' => 'Assessment created successfully',
    'assessment' => $created_assessment
]);
