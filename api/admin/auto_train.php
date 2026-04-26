<?php
require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

/**
 * Automatic Model Training Endpoint
 * 
 * Purpose: Run model training automatically when new assessment data arrives.
 * Triggers when:
 * - At least 5 new assessments since last training
 * - At least 6+ hours since last training
 * - Minimum thresholds met (10+ recommendations, 3+ strands, 50+ weighted rows)
 * 
 * Call this endpoint periodically or after each assessment submission.
 * Returns training status without blocking; suitable for background execution.
 */

try {
    $db = get_db_connection();

    // Get training configuration
    define('MIN_NEW_ASSESSMENTS', 5);
    define('MIN_HOURS_SINCE_TRAINING', 6);
    define('MIN_RECOMMENDATIONS', 10);
    define('MIN_STRAND_COVERAGE', 3);
    define('MIN_WEIGHTED_ROWS', 50);

    // Check if auto-training is currently disabled (for maintenance)
    $disableFlag = file_exists(__DIR__ . '/../.disable_auto_train');
    if ($disableFlag) {
        json_response(200, [
            'success' => true,
            'message' => 'Auto-training is currently disabled',
            'data' => ['status' => 'disabled']
        ]);
    }

    // Get last successful training run
    $lastTraining = $db->query('SELECT run_id, finished_at FROM ai_training_runs WHERE status = "completed" ORDER BY finished_at DESC LIMIT 1')->fetch_assoc();
    $lastTrainedAt = $lastTraining ? strtotime($lastTraining['finished_at']) : 0;
    $hoursSinceTraining = ($lastTrainedAt > 0) ? (time() - $lastTrainedAt) / 3600 : PHP_INT_MAX;

    // Count new assessments since last training
    $newAssessmentQuery = 'SELECT COUNT(*) AS count FROM assessment_results WHERE date_taken > FROM_UNIXTIME(?)';
    $stmt = $db->prepare($newAssessmentQuery);
    $stmt->bind_param('i', $lastTrainedAt);
    $stmt->execute();
    $newAssessmentResult = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $newAssessmentCount = (int)($newAssessmentResult['count'] ?? 0);

    // Get current dataset statistics
    $trainingSamples = rf_collect_training_samples($db);
    $datasetCount = count($trainingSamples);
    $classCoverage = count(array_unique(array_column($trainingSamples, 'label')));

    $assessmentRows = $db->query('SELECT COUNT(*) AS c FROM assessment_results WHERE domain IN ("STEM","ABM","HUMSS","TVL","GAS")')->fetch_assoc();
    $weightedRows = (int)($assessmentRows['c'] ?? 0);

    // Determine if training should trigger
    $shouldTrain = false;
    $reason = '';

    if ($datasetCount < MIN_RECOMMENDATIONS || $classCoverage < MIN_STRAND_COVERAGE || $weightedRows < MIN_WEIGHTED_ROWS) {
        $reason = sprintf(
            'Insufficient data: %d recommendations (need %d), %d strands (need %d), %d weighted rows (need %d)',
            $datasetCount,
            MIN_RECOMMENDATIONS,
            $classCoverage,
            MIN_STRAND_COVERAGE,
            $weightedRows,
            MIN_WEIGHTED_ROWS
        );
    } elseif ($newAssessmentCount < MIN_NEW_ASSESSMENTS && $hoursSinceTraining < MIN_HOURS_SINCE_TRAINING) {
        $reason = sprintf(
            'Not enough new data: %d assessments since last training (need %d), %.1f hours elapsed (need %d)',
            $newAssessmentCount,
            MIN_NEW_ASSESSMENTS,
            $hoursSinceTraining,
            MIN_HOURS_SINCE_TRAINING
        );
    } else {
        $shouldTrain = true;
        $reason = sprintf(
            'Training triggered: %d new assessments (threshold: %d), %.1f hours elapsed (threshold: %d hours)',
            $newAssessmentCount,
            MIN_NEW_ASSESSMENTS,
            $hoursSinceTraining,
            MIN_HOURS_SINCE_TRAINING
        );
    }

    // If training should run, execute it
    if ($shouldTrain) {
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
            $runMessage = 'Auto-training failed: ' . ($pythonResult['message'] ?? 'Unknown error');
            $runStmt = $db->prepare('INSERT INTO ai_training_runs (status, message, samples_used, class_coverage, weighted_rows_used, started_at, finished_at) VALUES ("failed", ?, ?, ?, ?, NOW(), NOW())');
            $runStmt->bind_param('siii', $runMessage, $datasetCount, $classCoverage, $weightedRows);
            $runStmt->execute();
            $runId = (int)$runStmt->insert_id;
            $runStmt->close();

            json_response(500, [
                'success' => false,
                'message' => $runMessage,
                'data' => [
                    'status' => 'failed',
                    'run_id' => $runId,
                    'dataset_count' => $datasetCount,
                    'class_coverage' => $classCoverage,
                    'weighted_rows_used' => $weightedRows,
                    'new_assessments' => $newAssessmentCount,
                    'hours_since_last_training' => round($hoursSinceTraining, 1),
                    'reason' => $reason
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

        $runMessage = sprintf('Auto-training completed successfully via %s evaluation.', $pythonResult['evaluation_mode'] ?? 'training');
        $runStmt = $db->prepare('INSERT INTO ai_training_runs (model_id, status, message, samples_used, class_coverage, weighted_rows_used, accuracy_score, started_at, finished_at) VALUES (?, "completed", ?, ?, ?, ?, ?, NOW(), NOW())');
        $runStmt->bind_param('isiiid', $modelId, $runMessage, $datasetCount, $classCoverage, $weightedRows, $accuracy);
        $runStmt->execute();
        $runId = (int)$runStmt->insert_id;
        $runStmt->close();

        // Log the auto-training event
        error_log(sprintf('[AUTO-TRAIN] Model %d trained successfully. Accuracy: %.2f%%. Datasets: %d, Classes: %d, Weighted rows: %d', $modelId, $accuracy, $datasetCount, $classCoverage, $weightedRows));

        json_response(200, [
            'success' => true,
            'message' => 'Model training triggered automatically',
            'data' => [
                'status' => 'completed',
                'model_id' => $modelId,
                'run_id' => $runId,
                'accuracy_score' => round($accuracy, 2),
                'dataset_count' => $datasetCount,
                'class_coverage' => $classCoverage,
                'weighted_rows_used' => $weightedRows,
                'new_assessments' => $newAssessmentCount,
                'hours_since_last_training' => round($hoursSinceTraining, 1),
                'reason' => $reason,
                'evaluation_mode' => $pythonResult['evaluation_mode'] ?? null
            ]
        ]);
    } else {
        // Training not needed
        json_response(200, [
            'success' => true,
            'message' => 'Auto-training not triggered',
            'data' => [
                'status' => 'skipped',
                'reason' => $reason,
                'dataset_count' => $datasetCount,
                'class_coverage' => $classCoverage,
                'weighted_rows_used' => $weightedRows,
                'new_assessments' => $newAssessmentCount,
                'hours_since_last_training' => round($hoursSinceTraining, 1)
            ]
        ]);
    }
} catch (Throwable $e) {
    error_log('[AUTO-TRAIN ERROR] ' . $e->getMessage());
    json_response(500, [
        'success' => false,
        'message' => 'Auto-training check failed',
        'error' => $e->getMessage()
    ]);
}
