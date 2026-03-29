<?php
// Database configuration for local XAMPP.
define('DB_HOST', '127.0.0.1');
define('DB_PORT', 3306);
define('DB_NAME', 'strandwise');
define('DB_USER', 'root');
define('DB_PASS', '');

// Default bootstrap admin credentials.
define('DEFAULT_ADMIN_EMAIL', 'admin@gmail.com');
define('DEFAULT_ADMIN_PASSWORD', 'administrator');
define('DEFAULT_ADMIN_FIRST_NAME', 'System');
define('DEFAULT_ADMIN_LAST_NAME', 'Admin');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function get_db_connection(): mysqli
{
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
    $conn->set_charset('utf8mb4');
    return $conn;
}
