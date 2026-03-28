<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Only POST requests are allowed.'
    ]);
    exit;
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

if (!is_array($payload) || !isset($payload['questions']) || !is_array($payload['questions'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request payload.'
    ]);
    exit;
}

$normalizedQuestions = [];

foreach ($payload['questions'] as $question) {
    if (!is_array($question)) {
        continue;
    }

    $id = isset($question['id']) ? (int) $question['id'] : 0;
    $text = isset($question['text']) ? trim((string) $question['text']) : '';
    $options = isset($question['options']) && is_array($question['options']) ? $question['options'] : [];

    $normalizedOptions = [];
    foreach ($options as $option) {
        $optionText = trim((string) $option);
        if ($optionText !== '') {
            $normalizedOptions[] = $optionText;
        }
    }

    if ($id <= 0 || $text === '' || count($normalizedOptions) < 2) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Each question must have a valid id, text, and at least 2 options.'
        ]);
        exit;
    }

    $normalizedQuestions[] = [
        'id' => $id,
        'text' => $text,
        'options' => array_values($normalizedOptions)
    ];
}

usort($normalizedQuestions, static function (array $left, array $right): int {
    return $left['id'] <=> $right['id'];
});

$questionsFile = __DIR__ . DIRECTORY_SEPARATOR . 'questions.json';
$json = json_encode(
    ['questions' => $normalizedQuestions],
    JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);

if ($json === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to encode questions.'
    ]);
    exit;
}

$bytesWritten = file_put_contents($questionsFile, $json . PHP_EOL, LOCK_EX);

if ($bytesWritten === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to write questions.json.'
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Questions saved successfully.',
    'count' => count($normalizedQuestions)
]);
