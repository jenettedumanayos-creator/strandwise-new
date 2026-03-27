<?php
require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $auth = require_role('student');
    $db = get_db_connection();

    // Match schema: students.student_id
    $stmt = $db->prepare('SELECT student_id FROM students WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $auth['user_id']);
    $stmt->execute();
    $student = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$student) {
        json_response(404, [
            'success' => false,
            'message' => 'Student profile not found'
        ]);
    }

    $studentId = (int)$student['student_id'];

    // Match schema: assessment_results.result_id/date_taken
    $stmt = $db->prepare(
        'SELECT result_id, assessment_id, domain, score, date_taken
         FROM assessment_results
         WHERE student_id = ?
         ORDER BY date_taken DESC, result_id DESC
         LIMIT 20'
    );
    $stmt->bind_param('i', $studentId);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    if (empty($rows)) {
        json_response(200, [
            'success' => true,
            'data' => [
                'id' => null,
                'submitted_at' => null,
                'domains' => [],
                'domain_scores' => [],
                'top_recommendation' => null
            ]
        ]);
    }

    $assessments = [];
    $domainScores = [];

    foreach ($rows as $row) {
        $assessmentId = (int)$row['assessment_id'];
        $domain = trim((string)$row['domain']);
        $score = (int)round((float)$row['score']);

        if (!isset($assessments[$assessmentId])) {
            $assessments[$assessmentId] = [
                'id' => $assessmentId,
                'submitted_at' => $row['date_taken'],
                'domains' => []
            ];
        }

        $assessments[$assessmentId]['domains'][$domain] = [
            'score' => $score,
            'strand_id' => null,
            'strand_name' => $domain,
            'strand_description' => null
        ];

        $domainScores[$domain] = $score;
    }

    arsort($domainScores);
    $topStrand = array_key_first($domainScores);

    $latestAssessment = array_shift($assessments);
    $latestAssessment['domain_scores'] = $domainScores;
    $latestAssessment['top_recommendation'] = $topStrand !== null ? [
        'strand' => $topStrand,
        'score' => $domainScores[$topStrand],
        'confidence' => (string)round(($domainScores[$topStrand] / 35) * 100) . '%'
    ] : null;

    json_response(200, [
        'success' => true,
        'data' => $latestAssessment
    ]);
} catch (Throwable $e) {
    json_response(500, [
        'success' => false,
        'message' => 'Failed to load assessment results',
        'error' => $e->getMessage()
    ]);
}
