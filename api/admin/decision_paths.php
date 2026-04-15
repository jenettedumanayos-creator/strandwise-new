<?php
require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

try {
    require_method('GET');
    require_role('admin');

    $db = get_db_connection();

    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $filterStrand = trim((string)($_GET['strand'] ?? ''));
    $filterRequiresCounselor = isset($_GET['requires_counselor']) ? (bool)$_GET['requires_counselor'] : null;
    $filterMinConfidence = isset($_GET['min_confidence']) ? (float)$_GET['min_confidence'] : null;

    $where = ['1=1'];
    $params = [];
    $types = '';

    if ($filterStrand !== '') {
        $where[] = 's.strand_code = ?';
        $params[] = $filterStrand;
        $types .= 's';
    }

    $whereClause = implode(' AND ', $where);

    $countSql = 'SELECT COUNT(r.recommendation_id) AS total
                 FROM recommendations r
                 INNER JOIN strands s ON s.strand_id = r.recommended_strand_id
                 WHERE ' . $whereClause;

    $stmt = $db->prepare($countSql);
    if (!empty($params) && $types) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $countResult = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $total = (int)($countResult['total'] ?? 0);
    $totalPages = ceil($total / $limit);

    $sql = 'SELECT r.recommendation_id, r.student_id, r.confidence_score, r.date_generated,
                   r.final_decision_basis, r.explanation_text,
                   s.strand_code, s.strand_name,
                   u.first_name, u.last_name, u.email,
                   m.model_name, m.algorithm_type
            FROM recommendations r
            INNER JOIN strands s ON s.strand_id = r.recommended_strand_id
            INNER JOIN ai_models m ON m.model_id = r.model_id
            LEFT JOIN students st ON st.student_id = r.student_id
            LEFT JOIN users u ON u.user_id = st.user_id
            WHERE ' . $whereClause . '
            ORDER BY r.date_generated DESC, r.recommendation_id DESC
            LIMIT ? OFFSET ?';

    $stmt = $db->prepare($sql);
    $params[] = $limit;
    $params[] = $offset;
    $types .= 'ii';
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $recommendations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $processed = [];
    foreach ($recommendations as $rec) {
        $explData = json_decode((string)$rec['explanation_text'], true) ?? [];
        $tie = $explData['tie_resolution'] ?? [];

        $requiresCounselor = (bool)($tie['requires_counselor_override'] ?? false);

        if ($filterRequiresCounselor !== null && $requiresCounselor !== $filterRequiresCounselor) {
            continue;
        }

        $confidence = (float)$rec['confidence_score'];
        if ($filterMinConfidence !== null && $confidence < $filterMinConfidence) {
            continue;
        }

        $processed[] = [
            'recommendation_id' => (int)$rec['recommendation_id'],
            'student_id' => (int)$rec['student_id'],
            'student_name' => trim(($rec['first_name'] ?? '') . ' ' . ($rec['last_name'] ?? '')),
            'student_email' => $rec['email'] ?? 'unknown',
            'recommended_strand' => $rec['strand_code'],
            'strand_name' => $rec['strand_name'],
            'confidence_score' => round((float)$rec['confidence_score'], 2),
            'date_generated' => $rec['date_generated'],
            'model' => [
                'name' => $rec['model_name'],
                'algorithm' => $rec['algorithm_type']
            ],
            'decision_basis' => $rec['final_decision_basis'],
            'decision_path' => $tie['decision_path'] ?? [],
            'requires_counselor_review' => $requiresCounselor,
            'tvl_subtracks' => $explData['tvl_subtracks'] ?? null,
            'score_band' => $explData['score_band'] ?? null
        ];
    }

    json_response(200, [
        'success' => true,
        'message' => 'Decision paths retrieved',
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => $totalPages
        ],
        'filters_applied' => [
            'strand' => $filterStrand ?: null,
            'requires_counselor' => $filterRequiresCounselor,
            'min_confidence' => $filterMinConfidence
        ],
        'data' => $processed
    ]);
} catch (Throwable $e) {
    json_response(500, [
        'success' => false,
        'message' => 'Failed to retrieve decision paths',
        'error' => $e->getMessage()
    ]);
}
