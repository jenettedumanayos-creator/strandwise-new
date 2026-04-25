<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('GET');
require_role('admin');

$db = get_db_connection();

$registeredStudents = (int) $db->query('SELECT COUNT(*) AS c FROM students st INNER JOIN users u ON u.user_id = st.user_id')->fetch_assoc()['c'];
$totalUsers = $registeredStudents;
$totalStudents = $registeredStudents;
$totalSchools = (int) $db->query('SELECT COUNT(*) AS c FROM schools')->fetch_assoc()['c'];
$totalResponses = (int) $db->query('SELECT COUNT(*) AS c FROM survey_responses')->fetch_assoc()['c'];
$totalRecommendations = (int) $db->query('SELECT COUNT(*) AS c FROM recommendations')->fetch_assoc()['c'];

$topStrands = [];
$result = $db->query('SELECT st.strand_code, st.strand_name, COUNT(r.recommendation_id) AS total FROM recommendations r INNER JOIN strands st ON st.strand_id = r.recommended_strand_id GROUP BY st.strand_id, st.strand_code, st.strand_name ORDER BY total DESC LIMIT 5');
while ($row = $result->fetch_assoc()) {
    $topStrands[] = $row;
}

json_response(200, [
    'success' => true,
    'message' => 'Admin stats loaded',
    'data' => [
        'total_users' => $totalUsers,
        'total_students' => $totalStudents,
        'total_schools' => $totalSchools,
        'total_survey_responses' => $totalResponses,
        'total_recommendations' => $totalRecommendations,
        'top_strands' => $topStrands
    ]
]);
