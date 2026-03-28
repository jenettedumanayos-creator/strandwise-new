<?php
require_once __DIR__ . '/../bootstrap.php';

require_role('admin');

$db = get_db_connection();

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    $assessmentId = (int)($_GET['assessment_id'] ?? 0);

    if ($assessmentId > 0) {
        $stmt = $db->prepare('SELECT a.assessment_id, a.assessment_name, a.description, a.created_at, COUNT(ar.result_id) AS responses FROM assessments a LEFT JOIN assessment_results ar ON ar.assessment_id = a.assessment_id WHERE a.assessment_id = ? GROUP BY a.assessment_id, a.assessment_name, a.description, a.created_at LIMIT 1');
        $stmt->bind_param('i', $assessmentId);
        $stmt->execute();
        $assessment = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$assessment) {
            json_response(404, [
                'success' => false,
                'message' => 'Assessment not found'
            ]);
        }

        json_response(200, [
            'success' => true,
            'message' => 'Assessment loaded',
            'data' => $assessment
        ]);
    }

    $search = trim((string)($_GET['search'] ?? ''));
    $limit = min(max((int)($_GET['limit'] ?? 100), 1), 200);

    $sql = 'SELECT a.assessment_id, a.assessment_name, a.description, a.created_at, COUNT(ar.result_id) AS responses
            FROM assessments a
            LEFT JOIN assessment_results ar ON ar.assessment_id = a.assessment_id
            WHERE 1=1';
    $params = [];
    $types = '';

    if ($search !== '') {
        $sql .= ' AND (a.assessment_name LIKE ? OR a.description LIKE ?)';
        $searchLike = '%' . $search . '%';
        $params[] = $searchLike;
        $params[] = $searchLike;
        $types .= 'ss';
    }

    $sql .= ' GROUP BY a.assessment_id, a.assessment_name, a.description, a.created_at
              ORDER BY a.assessment_id DESC
              LIMIT ?';
    $params[] = $limit;
    $types .= 'i';

    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();

    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $stmt->close();

    json_response(200, [
        'success' => true,
        'message' => 'Assessments loaded',
        'data' => $rows
    ]);
}

if ($method === 'PUT' || $method === 'PATCH') {
    $payload = read_json_body();

    $assessmentId = (int)($payload['assessment_id'] ?? 0);
    $name = trim((string)($payload['name'] ?? ''));
    $description = trim((string)($payload['description'] ?? ''));

    if ($assessmentId <= 0) {
        json_response(422, [
            'success' => false,
            'message' => 'assessment_id is required'
        ]);
    }

    if ($name === '' || $description === '') {
        json_response(422, [
            'success' => false,
            'message' => 'name and description are required'
        ]);
    }

    if (strlen($name) < 3) {
        json_response(422, [
            'success' => false,
            'message' => 'Assessment name must be at least 3 characters'
        ]);
    }

    if (strlen($description) < 10) {
        json_response(422, [
            'success' => false,
            'message' => 'Assessment description must be at least 10 characters'
        ]);
    }

    $stmt = $db->prepare('SELECT assessment_id FROM assessments WHERE assessment_id = ? LIMIT 1');
    $stmt->bind_param('i', $assessmentId);
    $stmt->execute();
    $existingById = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$existingById) {
        json_response(404, [
            'success' => false,
            'message' => 'Assessment not found'
        ]);
    }

    $stmt = $db->prepare('SELECT assessment_id FROM assessments WHERE assessment_name = ? AND assessment_id <> ? LIMIT 1');
    $stmt->bind_param('si', $name, $assessmentId);
    $stmt->execute();
    $duplicate = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($duplicate) {
        json_response(409, [
            'success' => false,
            'message' => 'An assessment with this name already exists'
        ]);
    }

    $stmt = $db->prepare('UPDATE assessments SET assessment_name = ?, description = ? WHERE assessment_id = ?');
    $stmt->bind_param('ssi', $name, $description, $assessmentId);
    $stmt->execute();
    $stmt->close();

    $stmt = $db->prepare('SELECT assessment_id, assessment_name, description, created_at FROM assessments WHERE assessment_id = ? LIMIT 1');
    $stmt->bind_param('i', $assessmentId);
    $stmt->execute();
    $updatedAssessment = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    json_response(200, [
        'success' => true,
        'message' => 'Assessment updated successfully',
        'data' => $updatedAssessment
    ]);
}

if ($method === 'DELETE') {
    $payload = read_json_body();
    $assessmentId = (int)($payload['assessment_id'] ?? ($_GET['assessment_id'] ?? 0));

    if ($assessmentId <= 0) {
        json_response(422, [
            'success' => false,
            'message' => 'assessment_id is required'
        ]);
    }

    $stmt = $db->prepare('DELETE FROM assessments WHERE assessment_id = ?');
    $stmt->bind_param('i', $assessmentId);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if ($affected < 1) {
        json_response(404, [
            'success' => false,
            'message' => 'Assessment not found'
        ]);
    }

    json_response(200, [
        'success' => true,
        'message' => 'Assessment deleted successfully'
    ]);
}

require_method('POST');

$payload = read_json_body();

$name = trim((string)($payload['name'] ?? ''));
$description = trim((string)($payload['description'] ?? ''));

if ($name === '' || $description === '') {
    json_response(422, [
        'success' => false,
        'message' => 'name and description are required'
    ]);
}

if (strlen($name) < 3) {
    json_response(422, [
        'success' => false,
        'message' => 'Assessment name must be at least 3 characters'
    ]);
}

if (strlen($description) < 10) {
    json_response(422, [
        'success' => false,
        'message' => 'Assessment description must be at least 10 characters'
    ]);
}

try {
    $stmt = $db->prepare('SELECT assessment_id FROM assessments WHERE assessment_name = ? LIMIT 1');
    $stmt->bind_param('s', $name);
    $stmt->execute();
    $existing = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($existing) {
        json_response(409, [
            'success' => false,
            'message' => 'An assessment with this name already exists'
        ]);
    }

    $stmt = $db->prepare('INSERT INTO assessments (assessment_name, description) VALUES (?, ?)');
    $stmt->bind_param('ss', $name, $description);
    $stmt->execute();
    $assessmentId = (int)$db->insert_id;
    $stmt->close();

    $stmt = $db->prepare('SELECT assessment_id, assessment_name, description, created_at FROM assessments WHERE assessment_id = ? LIMIT 1');
    $stmt->bind_param('i', $assessmentId);
    $stmt->execute();
    $createdAssessment = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    json_response(201, [
        'success' => true,
        'message' => 'Assessment created successfully',
        'data' => $createdAssessment
    ]);
} catch (Throwable $err) {
    json_response(500, [
        'success' => false,
        'message' => 'Failed to create assessment',
        'error' => $err->getMessage()
    ]);
}
