<?php
require_once __DIR__ . '/../bootstrap.php';

require_role('admin');

$db = get_db_connection();
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

function ensure_survey_questions_table(mysqli $db): void
{
    $db->query(
        'CREATE TABLE IF NOT EXISTS survey_questions (
            question_id INT AUTO_INCREMENT PRIMARY KEY,
            question_text TEXT NOT NULL,
            category VARCHAR(100) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

function category_from_question_number(int $questionNumber): string
{
    if ($questionNumber >= 1 && $questionNumber <= 10) {
        return 'Part I: Academic Interests & Strengths';
    }

    if ($questionNumber >= 11 && $questionNumber <= 20) {
        return 'Part II: Career Goals & Future Plans';
    }

    if ($questionNumber >= 21 && $questionNumber <= 28) {
        return 'Part III: Personality & Work Style';
    }

    if ($questionNumber >= 29 && $questionNumber <= 35) {
        return 'Part IV: Family Background & Finances';
    }

    return 'General';
}

function seed_questions_from_json_if_empty(mysqli $db): void
{
    $row = $db->query('SELECT COUNT(*) AS c FROM survey_questions')->fetch_assoc();
    $count = (int) ($row['c'] ?? 0);
    if ($count > 0) {
        return;
    }

    $questionsFile = realpath(__DIR__ . '/../../questions.json');
    if (!$questionsFile || !is_file($questionsFile)) {
        return;
    }

    $raw = file_get_contents($questionsFile);
    if ($raw === false || trim($raw) === '') {
        return;
    }

    $decoded = json_decode($raw, true);
    $questions = is_array($decoded) ? ($decoded['questions'] ?? null) : null;
    if (!is_array($questions) || $questions === []) {
        return;
    }

    $stmt = $db->prepare('INSERT INTO survey_questions (question_id, question_text, category) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE question_text = VALUES(question_text), category = VALUES(category)');
    foreach ($questions as $q) {
        $questionId = (int) ($q['id'] ?? 0);
        $questionText = trim((string) ($q['text'] ?? ''));

        if ($questionId <= 0 || $questionText === '') {
            continue;
        }

        $category = category_from_question_number($questionId);
        $stmt->bind_param('iss', $questionId, $questionText, $category);
        $stmt->execute();
    }
    $stmt->close();
}

ensure_survey_questions_table($db);
seed_questions_from_json_if_empty($db);

if ($method === 'GET') {
    $questionId = (int) ($_GET['question_id'] ?? 0);

    if ($questionId > 0) {
        $stmt = $db->prepare('SELECT sq.question_id, sq.question_text, sq.category, COUNT(sr.response_id) AS responses FROM survey_questions sq LEFT JOIN survey_responses sr ON sr.question_id = sq.question_id WHERE sq.question_id = ? GROUP BY sq.question_id, sq.question_text, sq.category LIMIT 1');
        $stmt->bind_param('i', $questionId);
        $stmt->execute();
        $question = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$question) {
            json_response(404, [
                'success' => false,
                'message' => 'Question not found'
            ]);
        }

        json_response(200, [
            'success' => true,
            'message' => 'Question loaded',
            'data' => $question
        ]);
    }

    $search = trim((string) ($_GET['search'] ?? ''));
    $categoryFilter = trim((string) ($_GET['category'] ?? ''));
    $limit = min(max((int) ($_GET['limit'] ?? 500), 1), 1000);

    $sql = 'SELECT sq.question_id, sq.question_text, sq.category, COUNT(sr.response_id) AS responses
            FROM survey_questions sq
            LEFT JOIN survey_responses sr ON sr.question_id = sq.question_id
            WHERE 1=1';
    $params = [];
    $types = '';

    if ($search !== '') {
        $sql .= ' AND sq.question_text LIKE ?';
        $searchLike = '%' . $search . '%';
        $params[] = $searchLike;
        $types .= 's';
    }

    if ($categoryFilter !== '' && strtolower($categoryFilter) !== 'all') {
        $sql .= ' AND sq.category = ?';
        $params[] = $categoryFilter;
        $types .= 's';
    }

    $sql .= ' GROUP BY sq.question_id, sq.question_text, sq.category
              ORDER BY sq.question_id ASC
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
        'message' => 'Questions loaded',
        'data' => $rows
    ]);
}

if ($method === 'PUT' || $method === 'PATCH') {
    $payload = read_json_body();

    $questionId = (int) ($payload['question_id'] ?? 0);
    $questionText = trim((string) ($payload['question_text'] ?? ''));
    $category = trim((string) ($payload['category'] ?? ''));

    if ($questionId <= 0) {
        json_response(422, [
            'success' => false,
            'message' => 'question_id is required'
        ]);
    }

    if ($questionText === '') {
        json_response(422, [
            'success' => false,
            'message' => 'question_text is required'
        ]);
    }

    if ($category === '') {
        $category = 'General';
    }

    $stmt = $db->prepare('SELECT question_id FROM survey_questions WHERE question_id = ? LIMIT 1');
    $stmt->bind_param('i', $questionId);
    $stmt->execute();
    $existing = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$existing) {
        json_response(404, [
            'success' => false,
            'message' => 'Question not found'
        ]);
    }

    $stmt = $db->prepare('UPDATE survey_questions SET question_text = ?, category = ? WHERE question_id = ?');
    $stmt->bind_param('ssi', $questionText, $category, $questionId);
    $stmt->execute();
    $stmt->close();

    $stmt = $db->prepare('SELECT question_id, question_text, category FROM survey_questions WHERE question_id = ? LIMIT 1');
    $stmt->bind_param('i', $questionId);
    $stmt->execute();
    $updated = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    json_response(200, [
        'success' => true,
        'message' => 'Question updated successfully',
        'data' => $updated
    ]);
}

if ($method === 'DELETE') {
    $payload = read_json_body();
    $questionId = (int) ($payload['question_id'] ?? ($_GET['question_id'] ?? 0));

    if ($questionId <= 0) {
        json_response(422, [
            'success' => false,
            'message' => 'question_id is required'
        ]);
    }

    $stmt = $db->prepare('DELETE FROM survey_questions WHERE question_id = ?');
    $stmt->bind_param('i', $questionId);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if ($affected < 1) {
        json_response(404, [
            'success' => false,
            'message' => 'Question not found'
        ]);
    }

    json_response(200, [
        'success' => true,
        'message' => 'Question deleted successfully'
    ]);
}

require_method('POST');

$payload = read_json_body();
$questionText = trim((string) ($payload['question_text'] ?? ''));
$category = trim((string) ($payload['category'] ?? ''));

if ($questionText === '') {
    json_response(422, [
        'success' => false,
        'message' => 'question_text is required'
    ]);
}

if ($category === '') {
    $category = 'General';
}

try {
    $stmt = $db->prepare('INSERT INTO survey_questions (question_text, category) VALUES (?, ?)');
    $stmt->bind_param('ss', $questionText, $category);
    $stmt->execute();
    $questionId = (int) $db->insert_id;
    $stmt->close();

    $stmt = $db->prepare('SELECT question_id, question_text, category FROM survey_questions WHERE question_id = ? LIMIT 1');
    $stmt->bind_param('i', $questionId);
    $stmt->execute();
    $created = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    json_response(201, [
        'success' => true,
        'message' => 'Question created successfully',
        'data' => $created
    ]);
} catch (Throwable $err) {
    json_response(500, [
        'success' => false,
        'message' => 'Failed to create question',
        'error' => $err->getMessage()
    ]);
}
