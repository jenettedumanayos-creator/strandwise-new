<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('GET');
require_role('admin');

$db = get_db_connection();

$db->query(
    'CREATE TABLE IF NOT EXISTS ai_training_runs (
        run_id INT AUTO_INCREMENT PRIMARY KEY,
        model_id INT NULL,
        triggered_by_admin_id INT NULL,
        status VARCHAR(20) NOT NULL,
        message VARCHAR(255) NULL,
        samples_used INT NOT NULL DEFAULT 0,
        class_coverage INT NOT NULL DEFAULT 0,
        weighted_rows_used INT NOT NULL DEFAULT 0,
        accuracy_score DECIMAL(5,2) NULL,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME NULL,
        CONSTRAINT fk_training_runs_model FOREIGN KEY (model_id) REFERENCES ai_models(model_id)
            ON UPDATE CASCADE
            ON DELETE SET NULL,
        CONSTRAINT fk_training_runs_admin FOREIGN KEY (triggered_by_admin_id) REFERENCES admins(admin_id)
            ON UPDATE CASCADE
            ON DELETE SET NULL,
        INDEX idx_training_runs_status (status),
        INDEX idx_training_runs_started (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

$datasetRow = $db->query('SELECT COUNT(*) AS c FROM recommendations')->fetch_assoc();
$datasetCount = (int)($datasetRow['c'] ?? 0);

$classRows = $db->query('SELECT COUNT(DISTINCT s.strand_code) AS c FROM recommendations r INNER JOIN strands s ON s.strand_id = r.recommended_strand_id')->fetch_assoc();
$classCoverage = (int)($classRows['c'] ?? 0);

$assessmentRows = $db->query('SELECT COUNT(*) AS c FROM assessment_results WHERE domain IN ("STEM","ABM","HUMSS","TVL","GAS")')->fetch_assoc();
$weightedResultRows = (int)($assessmentRows['c'] ?? 0);

$latestModel = null;
$modelResult = $db->query('SELECT model_id, model_name, algorithm_type, training_date, accuracy_score FROM ai_models ORDER BY training_date DESC, model_id DESC LIMIT 1');
if ($modelResult) {
    $latestModel = $modelResult->fetch_assoc() ?: null;
}

$latestRun = null;
$latestRunResult = $db->query('SELECT run_id, model_id, status, message, samples_used, class_coverage, weighted_rows_used, accuracy_score, started_at, finished_at FROM ai_training_runs ORDER BY run_id DESC LIMIT 1');
if ($latestRunResult) {
    $latestRun = $latestRunResult->fetch_assoc() ?: null;
}

$runHistory = [];
$historyResult = $db->query('SELECT run_id, model_id, status, message, samples_used, class_coverage, weighted_rows_used, accuracy_score, started_at, finished_at FROM ai_training_runs ORDER BY run_id DESC LIMIT 5');
if ($historyResult) {
    while ($row = $historyResult->fetch_assoc()) {
        $runHistory[] = $row;
    }
}

$hasModel = $latestModel !== null;
$hasAccuracy = $hasModel && $latestModel['accuracy_score'] !== null;

$milestones = [
    [
        'key' => 'data_collection',
        'label' => 'Data Collection',
        'done' => $datasetCount >= 30,
        'target' => '>= 30 labeled recommendations',
        'current' => (string)$datasetCount
    ],
    [
        'key' => 'class_coverage',
        'label' => 'Class Coverage',
        'done' => $classCoverage >= 5,
        'target' => 'All 5 strands present',
        'current' => (string)$classCoverage . '/5'
    ],
    [
        'key' => 'feature_rows',
        'label' => 'Feature Rows Ready',
        'done' => $weightedResultRows >= 150,
        'target' => '>= 150 weighted feature rows',
        'current' => (string)$weightedResultRows
    ],
    [
        'key' => 'model_initialized',
        'label' => 'Model Pipeline Initialized',
        'done' => $hasModel,
        'target' => 'Model record exists',
        'current' => $hasModel ? 'Yes' : 'No'
    ],
    [
        'key' => 'model_evaluated',
        'label' => 'Model Evaluated',
        'done' => $hasAccuracy,
        'target' => 'Accuracy score saved',
        'current' => $hasAccuracy ? ((string)$latestModel['accuracy_score'] . '%') : 'Pending'
    ]
];

$doneCount = 0;
foreach ($milestones as $m) {
    if ($m['done']) {
        $doneCount += 1;
    }
}

$progressPercent = (int)round(($doneCount / count($milestones)) * 100);

$currentPhase = 'Data Preparation';
if ($progressPercent >= 80) {
    $currentPhase = 'Model Evaluation & Deployment';
} elseif ($progressPercent >= 60) {
    $currentPhase = 'Model Training';
} elseif ($progressPercent >= 40) {
    $currentPhase = 'Feature Engineering';
}

json_response(200, [
    'success' => true,
    'message' => 'Model progress loaded',
    'data' => [
        'progress_percent' => $progressPercent,
        'current_phase' => $currentPhase,
        'dataset_count' => $datasetCount,
        'class_coverage' => $classCoverage,
        'weighted_result_rows' => $weightedResultRows,
        'latest_model' => $latestModel,
        'latest_run' => $latestRun,
        'run_history' => $runHistory,
        'milestones' => $milestones
    ]
]);
