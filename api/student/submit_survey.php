<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('POST');
$auth = require_role('student');

$payload = read_json_body();
$assessmentId = (int)($payload['assessment_id'] ?? 1);
$responses = $payload['responses'] ?? [];
$domainScores = $payload['domain_scores'] ?? [];

if (!is_array($responses) || count($responses) === 0) {
    json_response(422, [
        'success' => false,
        'message' => 'responses is required and must be a non-empty array'
    ]);
}

$db = get_db_connection();

$stmt = $db->prepare('SELECT student_id FROM students WHERE user_id = ? LIMIT 1');
$stmt->bind_param('i', $auth['user_id']);
$stmt->execute();
$student = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$student) {
    json_response(404, [
        'success' => false,
        'message' => 'Student profile not found for this user'
    ]);
}

$studentId = (int)$student['student_id'];

try {
    $db->begin_transaction();

    $insertResponse = $db->prepare('INSERT INTO survey_responses (student_id, question_id, rating, response_text) VALUES (?, ?, ?, ?)');

    foreach ($responses as $item) {
        $questionId = (int)($item['question_id'] ?? 0);
        $rating = isset($item['rating']) ? (int)$item['rating'] : null;
        $responseText = isset($item['response_text']) ? trim((string)$item['response_text']) : null;

        if ($questionId <= 0) {
            $db->rollback();
            json_response(422, [
                'success' => false,
                'message' => 'Each response must include a valid question_id'
            ]);
        }

        $insertResponse->bind_param('iiis', $studentId, $questionId, $rating, $responseText);
        $insertResponse->execute();
    }

    $insertResponse->close();

    if (is_array($domainScores) && count($domainScores) > 0) {
        $insertResult = $db->prepare('INSERT INTO assessment_results (student_id, assessment_id, domain, score) VALUES (?, ?, ?, ?)');

        foreach ($domainScores as $domain => $score) {
            $domainName = trim((string)$domain);
            $scoreValue = (float)$score;

            if ($domainName === '') {
                continue;
            }

            $insertResult->bind_param('iisd', $studentId, $assessmentId, $domainName, $scoreValue);
            $insertResult->execute();
        }

        $insertResult->close();
    }

    $db->commit();

    json_response(201, [
        'success' => true,
        'message' => 'Survey and assessment results saved successfully'
    ]);
} catch (Throwable $e) {
    $db->rollback();

    json_response(500, [
        'success' => false,
        'message' => 'Failed to save survey responses',
        'error' => $e->getMessage()
    ]);
}
