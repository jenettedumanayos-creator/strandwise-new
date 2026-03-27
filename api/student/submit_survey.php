<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

try {
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

    $db->begin_transaction();

    // Create a map to store question_id from DB for each frontend question
    $questionMap = [];
    
    $selectQuestion = $db->prepare('SELECT question_id FROM survey_questions WHERE question_text = ? LIMIT 1');
    $insertQuestion = $db->prepare('INSERT INTO survey_questions (question_text, category) VALUES (?, ?)');
    $insertResponse = $db->prepare('INSERT INTO survey_responses (student_id, question_id, rating, response_text) VALUES (?, ?, ?, ?)');

    foreach ($responses as $item) {
        $questionNum = (int)($item['question_id'] ?? 0);
        $questionText = trim((string)($item['question_text'] ?? ''));
        $category = trim((string)($item['category'] ?? 'General'));
        $rating = isset($item['rating']) ? (int)$item['rating'] : null;
        $responseText = isset($item['response_text']) ? trim((string)$item['response_text']) : null;

        if ($questionNum <= 0 || $questionText === '') {
            throw new Exception('Each response must include a valid question_id and question_text');
        }

        // Check if question already exists (by text)
        $selectQuestion->bind_param('s', $questionText);
        $selectQuestion->execute();
        $existingQuestion = $selectQuestion->get_result()->fetch_assoc();

        if ($existingQuestion) {
            $dbQuestionId = $existingQuestion['question_id'];
        } else {
            // Insert new question
            if ($category === '') {
                $category = 'General';
            }

            $insertQuestion->bind_param('ss', $questionText, $category);
            if (!$insertQuestion->execute()) {
                throw new Exception('Failed to insert question: ' . $db->error);
            }
            $dbQuestionId = $db->insert_id;
        }

        // Insert the response
        $insertResponse->bind_param('iiis', $studentId, $dbQuestionId, $rating, $responseText);
        if (!$insertResponse->execute()) {
            throw new Exception('Failed to insert response: ' . $db->error);
        }
    }

    $selectQuestion->close();
    $insertQuestion->close();
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
    if ($db) {
        try {
            $db->rollback();
        } catch (Throwable $rollbackErr) {
            // Ignore rollback errors
        }
    }

    error_log('Submit survey error: ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());

    json_response(500, [
        'success' => false,
        'message' => 'Failed to save survey responses: ' . $e->getMessage(),
        'error' => $e->getMessage(),
        'trace' => defined('DEBUG') && DEBUG ? $e->getTraceAsString() : null
    ]);
}
