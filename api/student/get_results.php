<?php
require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

function score_band(float $score): array
{
    if ($score >= 40) {
        return ['range' => '40-54', 'strength_level' => 'Strong Match'];
    }
    if ($score >= 25) {
        return ['range' => '25-39', 'strength_level' => 'Moderate Match'];
    }
    if ($score >= 10) {
        return ['range' => '10-24', 'strength_level' => 'Weak Match'];
    }
    return ['range' => 'Below 10', 'strength_level' => 'Poor Match'];
}

try {
    $auth = require_role('student');
    $db = get_db_connection();

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
    $allowedDomains = ['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'];

    $domainPlaceholders = implode(',', array_fill(0, count($allowedDomains), '?'));
    $types = 'i' . str_repeat('s', count($allowedDomains));
    $params = array_merge([$studentId], $allowedDomains);

    $sql = 'SELECT result_id, assessment_id, domain, score, date_taken
            FROM assessment_results
            WHERE student_id = ? AND domain IN (' . $domainPlaceholders . ')
            ORDER BY date_taken DESC, result_id DESC
            LIMIT 120';

    $stmt = $db->prepare($sql);
    $bindArgs = [];
    $bindArgs[] = &$types;
    foreach ($params as $k => $v) {
        $bindArgs[] = &$params[$k];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindArgs);
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
                'top_recommendation' => null,
                'model' => null,
                'score_band' => null,
                'max_weighted_score' => 54
            ]
        ]);
    }

    $domainScores = [];
    $domains = [];
    $submittedAt = null;
    $assessmentId = null;

    foreach ($rows as $row) {
        $domain = trim((string)$row['domain']);
        if (isset($domainScores[$domain])) {
            continue;
        }

        $score = (float)$row['score'];
        $domainScores[$domain] = round($score, 2);
        $domains[$domain] = [
            'score' => round($score, 2),
            'strand_name' => $domain,
            'strand_description' => null
        ];

        if ($submittedAt === null) {
            $submittedAt = $row['date_taken'];
            $assessmentId = (int)$row['assessment_id'];
        }

        if (count($domainScores) === count($allowedDomains)) {
            break;
        }
    }

    arsort($domainScores);
    $topStrand = array_key_first($domainScores);
    $topScore = $topStrand !== null ? (float)$domainScores[$topStrand] : 0.0;

    $recommendationSql = 'SELECT r.recommendation_id, r.confidence_score, r.final_decision_basis, r.explanation_text, r.date_generated,
                                 s.strand_code, s.strand_name,
                                 m.model_id, m.model_name, m.algorithm_type
                          FROM recommendations r
                          INNER JOIN strands s ON s.strand_id = r.recommended_strand_id
                          INNER JOIN ai_models m ON m.model_id = r.model_id
                          WHERE r.student_id = ?
                          ORDER BY r.date_generated DESC, r.recommendation_id DESC
                          LIMIT 1';
    $stmt = $db->prepare($recommendationSql);
    $stmt->bind_param('i', $studentId);
    $stmt->execute();
    $latestRecommendation = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $decisionPath = [];
    $requiresCounselorOverride = false;
    $tvlSubtracks = [];

    if ($latestRecommendation && !empty($latestRecommendation['explanation_text'])) {
        $parsed = json_decode((string)$latestRecommendation['explanation_text'], true);
        if (is_array($parsed)) {
            $tie = $parsed['tie_resolution'] ?? [];
            if (is_array($tie)) {
                $decisionPath = $tie['decision_path'] ?? [];
                $requiresCounselorOverride = (bool)($tie['requires_counselor_override'] ?? false);
            }

            $tvlSubtracks = is_array($parsed['tvl_subtracks'] ?? null) ? $parsed['tvl_subtracks'] : [];
        }
    }

    if ($latestRecommendation && !empty($latestRecommendation['strand_code'])) {
        $topStrand = (string)$latestRecommendation['strand_code'];
        $topScore = (float)($domainScores[$topStrand] ?? $topScore);
    }

    $band = score_band($topScore);
    $maxWeightedScore = 54;
    $confidencePercent = $latestRecommendation
        ? (float)$latestRecommendation['confidence_score']
        : round(($topScore / $maxWeightedScore) * 100, 2);

    json_response(200, [
        'success' => true,
        'data' => [
            'id' => $assessmentId,
            'submitted_at' => $submittedAt,
            'domains' => $domains,
            'domain_scores' => $domainScores,
            'top_recommendation' => $topStrand !== null ? [
                'strand' => $topStrand,
                'strand_name' => $latestRecommendation['strand_name'] ?? $topStrand,
                'score' => round($topScore, 2),
                'confidence' => round($confidencePercent, 2) . '%',
                'strength_level' => $band['strength_level'],
                'decision_basis' => $latestRecommendation['final_decision_basis'] ?? null
            ] : null,
            'model' => $latestRecommendation ? [
                'model_id' => (int)$latestRecommendation['model_id'],
                'model_name' => $latestRecommendation['model_name'],
                'algorithm_type' => $latestRecommendation['algorithm_type']
            ] : null,
            'decision_path' => $decisionPath,
            'requires_counselor_override' => $requiresCounselorOverride,
            'tvl_subtracks' => $tvlSubtracks,
            'score_band' => $band,
            'max_weighted_score' => $maxWeightedScore
        ]
    ]);
} catch (Throwable $e) {
    json_response(500, [
        'success' => false,
        'message' => 'Failed to load assessment results',
        'error' => $e->getMessage()
    ]);
}
