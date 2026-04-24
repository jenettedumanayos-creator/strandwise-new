<?php
session_start();

$role = strtolower((string) ($_SESSION['role'] ?? $_SESSION['userType'] ?? ''));

if ($role === 'admin') {
    header('Location: admin.html');
    exit;
}

if ($role !== '') {
    header('Location: main.html');
    exit;
}

require __DIR__ . '/login.html';
