<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('GET');
require_role('admin');

$db = get_db_connection();

$search = trim((string)($_GET['search'] ?? ''));
$grade = trim((string)($_GET['grade'] ?? ''));
$limit = min(max((int)($_GET['limit'] ?? 50), 1), 200);

$sql = 'SELECT st.student_id, st.first_name, st.last_name, st.grade_level, u.email, u.status, sc.school_name
        FROM students st
        INNER JOIN users u ON u.user_id = st.user_id
        LEFT JOIN schools sc ON sc.school_id = u.school_id
        WHERE 1=1';
$params = [];
$types = '';

if ($search !== '') {
    $sql .= ' AND (st.first_name LIKE ? OR st.last_name LIKE ? OR u.email LIKE ?)';
    $searchLike = '%' . $search . '%';
    $params[] = $searchLike;
    $params[] = $searchLike;
    $params[] = $searchLike;
    $types .= 'sss';
}

if ($grade !== '') {
    $sql .= ' AND st.grade_level = ?';
    $params[] = $grade;
    $types .= 's';
}

$sql .= ' ORDER BY st.student_id DESC LIMIT ?';
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
    'message' => 'Students list loaded',
    'data' => $rows
]);
