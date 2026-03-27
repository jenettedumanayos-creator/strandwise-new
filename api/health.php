<?php
require_once __DIR__ . '/bootstrap.php';

try {
    $db = get_db_connection();
    $db->query('SELECT 1');

    json_response(200, [
        'success' => true,
        'message' => 'API is healthy',
        'data' => [
            'db' => 'connected'
        ]
    ]);
} catch (Throwable $e) {
    json_response(500, [
        'success' => false,
        'message' => 'Health check failed',
        'error' => $e->getMessage()
    ]);
}
