<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('GET');
require_role('admin');

$db = get_db_connection();

$format = strtolower(trim((string)($_GET['format'] ?? 'json')));
if (!in_array($format, ['json', 'csv'], true)) {
    $format = 'json';
}

$limit = min(max((int)($_GET['limit'] ?? 500), 1), 5000);

function extract_weighted_scores(string $explanationText): array
{
    $base = [
        'STEM' => null,
        'ABM' => null,
        'HUMSS' => null,
        'TVL' => null,
        'GAS' => null
    ];

    $parsed = json_decode($explanationText, true);
    if (!is_array($parsed)) {
        return $base;
    }

    $weighted = $parsed['weighted_scores'] ?? null;
    if (!is_array($weighted)) {
        return $base;
    }

    foreach (array_keys($base) as $code) {
        if (isset($weighted[$code])) {
            $base[$code] = (float)$weighted[$code];
        }
    }

    return $base;
}

$latestSql = 'SELECT r.recommendation_id, r.student_id, r.confidence_score, r.date_generated, r.explanation_text,
                     s.strand_code AS target_strand,
                     u.user_id, u.first_name, u.last_name, u.email,
                     st.grade_level
              FROM recommendations r
              INNER JOIN (
                  SELECT student_id, MAX(recommendation_id) AS latest_recommendation_id
                  FROM recommendations
                  GROUP BY student_id
              ) lr ON lr.latest_recommendation_id = r.recommendation_id
              INNER JOIN strands s ON s.strand_id = r.recommended_strand_id
              INNER JOIN students st ON st.student_id = r.student_id
              INNER JOIN users u ON u.user_id = st.user_id
              ORDER BY r.recommendation_id DESC
              LIMIT ?';

$stmt = $db->prepare($latestSql);
$stmt->bind_param('i', $limit);
$stmt->execute();
$latestRecommendations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$rows = [];

$responseSql = 'SELECT rating
                FROM survey_responses
                WHERE student_id = ?
                ORDER BY response_id DESC
                LIMIT 35';
$responseStmt = $db->prepare($responseSql);

foreach ($latestRecommendations as $rec) {
    $studentId = (int)$rec['student_id'];

    $responseStmt->bind_param('i', $studentId);
    $responseStmt->execute();
    $ratingsRows = $responseStmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $ratingsDesc = array_map(static function ($item) {
        return isset($item['rating']) ? (int)$item['rating'] : 0;
    }, $ratingsRows);
    $ratingsAsc = array_reverse($ratingsDesc);

    $featureVector = [];
    for ($i = 0; $i < 35; $i += 1) {
        $featureVector['q' . ($i + 1)] = $ratingsAsc[$i] ?? 0;
    }

    $weightedScores = extract_weighted_scores((string)($rec['explanation_text'] ?? ''));

    $rows[] = array_merge([
        'recommendation_id' => (int)$rec['recommendation_id'],
        'student_id' => $studentId,
        'user_id' => (int)$rec['user_id'],
        'first_name' => $rec['first_name'],
        'last_name' => $rec['last_name'],
        'email' => $rec['email'],
        'grade_level' => $rec['grade_level'],
        'target_strand' => $rec['target_strand'],
        'confidence_score' => (float)$rec['confidence_score'],
        'date_generated' => $rec['date_generated'],
        'stem_weighted' => $weightedScores['STEM'],
        'abm_weighted' => $weightedScores['ABM'],
        'humss_weighted' => $weightedScores['HUMSS'],
        'tvl_weighted' => $weightedScores['TVL'],
        'gas_weighted' => $weightedScores['GAS']
    ], $featureVector);
}

$responseStmt->close();

if ($format === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="training_dataset_latest.csv"');

    $out = fopen('php://output', 'w');
    if ($out === false) {
        json_response(500, [
            'success' => false,
            'message' => 'Failed to open CSV output stream.'
        ]);
    }

    if (!empty($rows)) {
        fputcsv($out, array_keys($rows[0]));
        foreach ($rows as $row) {
            fputcsv($out, $row);
        }
    } else {
        fputcsv($out, ['message']);
        fputcsv($out, ['No training rows found.']);
    }

    fclose($out);
    exit;
}

json_response(200, [
    'success' => true,
    'message' => 'Training dataset exported.',
    'data' => [
        'count' => count($rows),
        'rows' => $rows
    ]
]);
