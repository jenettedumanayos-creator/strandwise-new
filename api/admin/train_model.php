<?php
require_once __DIR__ . '/../bootstrap.php';

require_method('POST');
$auth = require_role('admin');

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

$trainingSamples = rf_collect_training_samples($db);
$datasetCount = count($trainingSamples);
$classCoverage = count(array_unique(array_column($trainingSamples, 'label')));

$assessmentRows = $db->query('SELECT COUNT(*) AS c FROM assessment_results WHERE domain IN ("STEM","ABM","HUMSS","TVL","GAS")')->fetch_assoc();
$weightedRows = (int)($assessmentRows['c'] ?? 0);

if ($datasetCount < 10 || $classCoverage < 3 || $weightedRows < 50) {
    $message = 'Not enough data yet. Need at least 10 recommendations, 3 strand classes, and 50 weighted rows.';

    $runStmt = $db->prepare('INSERT INTO ai_training_runs (triggered_by_admin_id, status, message, samples_used, class_coverage, weighted_rows_used, started_at, finished_at) VALUES (?, "failed", ?, ?, ?, ?, NOW(), NOW())');
    $runStmt->bind_param('isiii', $auth['admin_id'], $message, $datasetCount, $classCoverage, $weightedRows);
    $runStmt->execute();
    $runId = (int)$runStmt->insert_id;
    $runStmt->close();

    json_response(422, [
        'success' => false,
        'message' => $message,
        'data' => [
            'run_id' => $runId,
            'dataset_count' => $datasetCount,
            'class_coverage' => $classCoverage,
            'weighted_rows_used' => $weightedRows
        ]
    ]);
}

$paths = rf_model_paths();
$pythonResult = rf_run_python([
    'action' => 'train',
    'feature_names' => rf_feature_names(),
    'samples' => $trainingSamples,
    'model_path' => $paths['model'],
    'metadata_path' => $paths['metadata'],
    'random_state' => 42,
    'n_estimators' => 250,
    'min_samples_leaf' => 1
]);

if (!($pythonResult['success'] ?? false)) {
    $runMessage = 'Random Forest training failed: ' . ($pythonResult['message'] ?? 'Unknown error');
    $runStmt = $db->prepare('INSERT INTO ai_training_runs (triggered_by_admin_id, status, message, samples_used, class_coverage, weighted_rows_used, started_at, finished_at) VALUES (?, "failed", ?, ?, ?, ?, NOW(), NOW())');
    $runStmt->bind_param('isiii', $auth['admin_id'], $runMessage, $datasetCount, $classCoverage, $weightedRows);
    $runStmt->execute();
    $runId = (int)$runStmt->insert_id;
    $runStmt->close();

    json_response(500, [
        'success' => false,
        'message' => $runMessage,
        'data' => [
            'run_id' => $runId,
            'dataset_count' => $datasetCount,
            'class_coverage' => $classCoverage,
            'weighted_rows_used' => $weightedRows
        ]
    ]);
}

$accuracy = (float)($pythonResult['accuracy_score'] ?? 0.0);
$modelName = 'Random Forest Strand Classifier ' . date('Y-m-d H:i');
$algorithm = 'Random Forest Classifier';

$modelStmt = $db->prepare('INSERT INTO ai_models (model_name, algorithm_type, accuracy_score, training_date) VALUES (?, ?, ?, NOW())');
$modelStmt->bind_param('ssd', $modelName, $algorithm, $accuracy);
$modelStmt->execute();
$modelId = (int)$modelStmt->insert_id;
$modelStmt->close();

$runMessage = sprintf('Random Forest training completed successfully via %s evaluation.', $pythonResult['evaluation_mode'] ?? 'training');
$runStmt = $db->prepare('INSERT INTO ai_training_runs (model_id, triggered_by_admin_id, status, message, samples_used, class_coverage, weighted_rows_used, accuracy_score, started_at, finished_at) VALUES (?, ?, "completed", ?, ?, ?, ?, ?, NOW(), NOW())');
$runStmt->bind_param('iisiiid', $modelId, $auth['admin_id'], $runMessage, $datasetCount, $classCoverage, $weightedRows, $accuracy);
$runStmt->execute();
$runId = (int)$runStmt->insert_id;
$runStmt->close();

json_response(200, [
    'success' => true,
    'message' => 'Random Forest model training completed.',
    'data' => [
        'run_id' => $runId,
        'model_id' => $modelId,
        'accuracy_score' => round($accuracy, 2),
        'dataset_count' => $datasetCount,
        'class_coverage' => $classCoverage,
        'weighted_rows_used' => $weightedRows,
        'evaluation_mode' => $pythonResult['evaluation_mode'] ?? null
    ]
]);
