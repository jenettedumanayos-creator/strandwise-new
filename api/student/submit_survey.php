<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

function rubric_parts(): array
{
    return [
        'part1' => ['label' => 'Part I: Academic Interests & Strengths', 'start' => 1, 'end' => 10, 'weight' => 1.5],
        'part2' => ['label' => 'Part II: Career Goals & Future Plans', 'start' => 11, 'end' => 20, 'weight' => 2.0],
        'part3' => ['label' => 'Part III: Personality & Work Style', 'start' => 21, 'end' => 28, 'weight' => 1.5],
        'part4' => ['label' => 'Part IV: Family Background & Finances', 'start' => 29, 'end' => 35, 'weight' => 1.0]
    ];
}

function rubric_strands(): array
{
    return [
        'STEM' => ['name' => 'Science, Technology, Engineering & Mathematics'],
        'ABM' => ['name' => 'Accountancy, Business & Management'],
        'HUMSS' => ['name' => 'Humanities & Social Sciences'],
        'TVL' => ['name' => 'Technical-Vocational-Livelihood'],
        'GAS' => ['name' => 'General Academic Strand']
    ];
}

function option_to_strand(int $rating): ?string
{
    $map = [
        1 => 'STEM',
        2 => 'ABM',
        3 => 'HUMSS',
        4 => 'TVL',
        5 => 'GAS'
    ];

    return $map[$rating] ?? null;
}

function resolve_part_key(int $questionNumber): string
{
    foreach (rubric_parts() as $partKey => $cfg) {
        if ($questionNumber >= $cfg['start'] && $questionNumber <= $cfg['end']) {
            return $partKey;
        }
    }

    return 'part4';
}

function score_band(float $score): array
{
    if ($score >= 40) {
        return [
            'range' => '40-54',
            'strength_level' => 'Strong Match',
            'recommendation' => 'Highly recommended. This strand closely aligns with the student profile.'
        ];
    }

    if ($score >= 25) {
        return [
            'range' => '25-39',
            'strength_level' => 'Moderate Match',
            'recommendation' => 'Good fit. Recommend with supplementary counseling on career alignment.'
        ];
    }

    if ($score >= 10) {
        return [
            'range' => '10-24',
            'strength_level' => 'Weak Match',
            'recommendation' => 'Possible but not ideal. Revisit with the student before finalizing.'
        ];
    }

    return [
        'range' => 'Below 10',
        'strength_level' => 'Poor Match',
        'recommendation' => 'Not recommended. Student should explore other strand options.'
    ];
}

function choose_unique_best(array $scores, array $candidates): ?string
{
    $best = null;
    $bestValue = -INF;
    $isTie = false;

    foreach ($candidates as $code) {
        $value = (float)($scores[$code] ?? 0.0);
        if ($value > $bestValue) {
            $bestValue = $value;
            $best = $code;
            $isTie = false;
        } elseif (abs($value - $bestValue) < 0.0001) {
            $isTie = true;
        }
    }

    return $isTie ? null : $best;
}

function has_any_keyword(string $haystack, array $keywords): bool
{
    foreach ($keywords as $keyword) {
        if (str_contains($haystack, $keyword)) {
            return true;
        }
    }

    return false;
}

function derive_tvl_subtracks(array $responses): array
{
    $scores = [
        'ICT' => 0.0,
        'Cookery' => 0.0,
        'Industrial' => 0.0
    ];

    $ictKeywords = ['ict', 'it ', 'information technology', 'computer', 'coding', 'programming', 'software', 'hardware', 'robotics', 'tech'];
    $cookeryKeywords = ['cook', 'culinary', 'kitchen', 'food', 'hospitality', 'baking', 'chef'];
    $industrialKeywords = ['automotive', 'electronics', 'electrical', 'carpentry', 'welding', 'agriculture', 'fisher', 'repair', 'technician', 'industrial'];

    $tvlAnswerCount = 0;

    foreach ($responses as $item) {
        $rating = isset($item['rating']) ? (int)$item['rating'] : 0;
        if ($rating !== 4) {
            continue;
        }

        $tvlAnswerCount += 1;

        $questionText = strtolower(trim((string)($item['question_text'] ?? '')));
        $responseText = strtolower(trim((string)($item['response_text'] ?? '')));
        $combined = $questionText . ' ' . $responseText;

        $matched = false;

        if (has_any_keyword($combined, $ictKeywords)) {
            $scores['ICT'] += 1.0;
            $matched = true;
        }

        if (has_any_keyword($combined, $cookeryKeywords)) {
            $scores['Cookery'] += 1.0;
            $matched = true;
        }

        if (has_any_keyword($combined, $industrialKeywords)) {
            $scores['Industrial'] += 1.0;
            $matched = true;
        }

        if (!$matched) {
            $scores['Industrial'] += 0.5;
        }
    }

    $total = array_sum($scores);
    if ($total <= 0) {
        $scores['ICT'] = 1.0;
        $scores['Cookery'] = 1.0;
        $scores['Industrial'] = 1.0;
        $total = 3.0;
    }

    $output = [];
    foreach ($scores as $name => $score) {
        $output[$name] = [
            'score' => round($score, 3),
            'percent' => round(($score / $total) * 100, 2)
        ];
    }

    $output['tvl_answer_count'] = $tvlAnswerCount;

    return $output;
}

function resolve_tie(array $weightedScores, array $partScores, array $tvlSubtracks): array
{
    $maxScore = max($weightedScores);
    $tied = [];
    foreach ($weightedScores as $code => $score) {
        if (abs($score - $maxScore) < 0.0001) {
            $tied[] = $code;
        }
    }

    $decisionPath = [];
    $requiresCounselorOverride = false;

    if (count($tied) === 1) {
        return [
            'selected' => $tied[0],
            'tied' => $tied,
            'decision_path' => ['No tie detected.'],
            'requires_counselor_override' => false
        ];
    }

    sort($tied);
    $pairKey = implode('|', $tied);

    if ($pairKey === 'ABM|STEM') {
        $pick = choose_unique_best($partScores['part1']['weighted'], $tied);
        if ($pick !== null) {
            $decisionPath[] = 'Special case STEM & ABM resolved using Part I dominance.';
            return [
                'selected' => $pick,
                'tied' => $tied,
                'decision_path' => $decisionPath,
                'requires_counselor_override' => false
            ];
        }
    }

    if ($pairKey === 'ABM|HUMSS') {
        $pick = choose_unique_best($partScores['part3']['weighted'], $tied);
        if ($pick !== null) {
            $decisionPath[] = 'Special case ABM & HUMSS resolved using Part III work-style dominance.';
            return [
                'selected' => $pick,
                'tied' => $tied,
                'decision_path' => $decisionPath,
                'requires_counselor_override' => false
            ];
        }
    }

    if ($pairKey === 'HUMSS|STEM') {
        $decisionPath[] = 'Special case STEM & HUMSS: recommend GAS for interdisciplinary exploration.';
        return [
            'selected' => 'GAS',
            'tied' => $tied,
            'decision_path' => $decisionPath,
            'requires_counselor_override' => true
        ];
    }

    if ($pairKey === 'ABM|TVL') {
        $pick = choose_unique_best($partScores['part4']['weighted'], $tied);
        if ($pick !== null) {
            $decisionPath[] = 'Special case TVL & ABM resolved using Part IV financial feasibility.';
            return [
                'selected' => $pick,
                'tied' => $tied,
                'decision_path' => $decisionPath,
                'requires_counselor_override' => false
            ];
        }
    }

    if ($pairKey === 'HUMSS|TVL') {
        $tvlSignal = (float)($partScores['part3']['weighted']['TVL'] ?? 0)
            + (float)($partScores['part4']['weighted']['TVL'] ?? 0)
            + ((float)($tvlSubtracks['ICT']['score'] ?? 0) * 0.35)
            + ((float)($tvlSubtracks['Cookery']['score'] ?? 0) * 0.35)
            + ((float)($tvlSubtracks['Industrial']['score'] ?? 0) * 0.3);

        $humssSignal = (float)($partScores['part3']['weighted']['HUMSS'] ?? 0)
            + (float)($partScores['part4']['weighted']['HUMSS'] ?? 0);

        if ($tvlSignal > $humssSignal + 0.25) {
            $decisionPath[] = 'Special case HUMSS & TVL resolved in favor of TVL using practical/TVL sub-track signal.';
            return [
                'selected' => 'TVL',
                'tied' => $tied,
                'decision_path' => $decisionPath,
                'requires_counselor_override' => false
            ];
        }

        if ($humssSignal > $tvlSignal + 0.25) {
            $decisionPath[] = 'Special case HUMSS & TVL resolved in favor of HUMSS using humanities/personality signal.';
            return [
                'selected' => 'HUMSS',
                'tied' => $tied,
                'decision_path' => $decisionPath,
                'requires_counselor_override' => false
            ];
        }
    }

    $pick = choose_unique_best($partScores['part2']['weighted'], $tied);
    if ($pick !== null) {
        $decisionPath[] = 'Step 1: Part II (Career Goals) dominance resolved the tie.';
        return [
            'selected' => $pick,
            'tied' => $tied,
            'decision_path' => $decisionPath,
            'requires_counselor_override' => false
        ];
    }

    $pick = choose_unique_best($partScores['part1']['weighted'], $tied);
    if ($pick !== null) {
        $decisionPath[] = 'Step 2: Part I (Academic Interests) dominance resolved the tie.';
        return [
            'selected' => $pick,
            'tied' => $tied,
            'decision_path' => $decisionPath,
            'requires_counselor_override' => false
        ];
    }

    $part4Raw = $partScores['part4']['raw'];
    $part4Total = array_sum($part4Raw);
    $tvlPart4Ratio = $part4Total > 0 ? ((float)$part4Raw['TVL'] / (float)$part4Total) : 0.0;
    if ($tvlPart4Ratio >= 0.5) {
        if (in_array('TVL', $tied, true)) {
            $decisionPath[] = 'Step 3: Part IV indicates strong livelihood pressure; TVL prioritized.';
            return [
                'selected' => 'TVL',
                'tied' => $tied,
                'decision_path' => $decisionPath,
                'requires_counselor_override' => false
            ];
        }

        if (in_array('GAS', $tied, true)) {
            $decisionPath[] = 'Step 3: Part IV indicates broad or constrained feasibility; GAS prioritized.';
            return [
                'selected' => 'GAS',
                'tied' => $tied,
                'decision_path' => $decisionPath,
                'requires_counselor_override' => false
            ];
        }
    }

    if (in_array('GAS', $tied, true)) {
        $decisionPath[] = 'Step 4: GAS used as tiebreaker default to preserve flexibility.';
        return [
            'selected' => 'GAS',
            'tied' => $tied,
            'decision_path' => $decisionPath,
            'requires_counselor_override' => false
        ];
    }

    $priority = ['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'];
    foreach ($priority as $code) {
        if (in_array($code, $tied, true)) {
            $decisionPath[] = 'Step 5: Tie unresolved by rubric; counselor interview override required.';
            $requiresCounselorOverride = true;
            return [
                'selected' => $code,
                'tied' => $tied,
                'decision_path' => $decisionPath,
                'requires_counselor_override' => $requiresCounselorOverride
            ];
        }
    }

    return [
        'selected' => $tied[0],
        'tied' => $tied,
        'decision_path' => ['Fallback tiebreak selected first candidate.'],
        'requires_counselor_override' => true
    ];
}

try {
    require_method('POST');
    $auth = require_role('student');

    $payload = read_json_body();
    $assessmentId = (int)($payload['assessment_id'] ?? 1);
    $responses = $payload['responses'] ?? [];

    if (!is_array($responses) || count($responses) === 0) {
        json_response(422, [
            'success' => false,
            'message' => 'responses is required and must be a non-empty array'
        ]);
    }

    $expectedQuestions = 35;
    if (count($responses) !== $expectedQuestions) {
        json_response(422, [
            'success' => false,
            'message' => 'All 35 rubric questions must be answered before submission.'
        ]);
    }

    $db = get_db_connection();

    $stmt = $db->prepare('SELECT student_id FROM students WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $auth['user_id']);
    $stmt->execute();
    $student = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$student) {
        json_response(404, [
            'success' => false,
            'message' => 'Student profile not found for this user'
        ]);
    }

    $studentId = (int)$student['student_id'];
    $parts = rubric_parts();
    $strands = rubric_strands();

    $rawScores = [];
    $weightedScores = [];
    foreach ($strands as $code => $_meta) {
        $rawScores[$code] = 0;
        $weightedScores[$code] = 0.0;
    }

    $partScores = [];
    foreach ($parts as $partKey => $cfg) {
        $partScores[$partKey] = [
            'label' => $cfg['label'],
            'weight' => $cfg['weight'],
            'raw' => array_fill_keys(array_keys($strands), 0),
            'weighted' => array_fill_keys(array_keys($strands), 0.0)
        ];
    }

    $db->begin_transaction();

    $selectQuestion = $db->prepare('SELECT question_id FROM survey_questions WHERE question_text = ? LIMIT 1');
    $insertQuestion = $db->prepare('INSERT INTO survey_questions (question_text, category) VALUES (?, ?)');
    $insertResponse = $db->prepare('INSERT INTO survey_responses (student_id, question_id, rating, response_text) VALUES (?, ?, ?, ?)');

    foreach ($responses as $item) {
        $questionNum = (int)($item['question_id'] ?? 0);
        $questionText = trim((string)($item['question_text'] ?? ''));
        $category = trim((string)($item['category'] ?? 'General'));
        $rating = isset($item['rating']) ? (int)$item['rating'] : 0;
        $responseText = isset($item['response_text']) ? trim((string)$item['response_text']) : null;

        if ($questionNum <= 0 || $questionText === '' || $rating < 1 || $rating > 5) {
            throw new Exception('Each response must include valid question_id, question_text, and rating (1-5).');
        }

        $strandCode = option_to_strand($rating);
        if ($strandCode === null) {
            throw new Exception('Invalid answer option mapping detected.');
        }

        $partKey = resolve_part_key($questionNum);
        $partWeight = (float)$parts[$partKey]['weight'];

        $rawScores[$strandCode] += 1;
        $weightedScores[$strandCode] += $partWeight;
        $partScores[$partKey]['raw'][$strandCode] += 1;
        $partScores[$partKey]['weighted'][$strandCode] += $partWeight;

        $selectQuestion->bind_param('s', $questionText);
        $selectQuestion->execute();
        $existingQuestion = $selectQuestion->get_result()->fetch_assoc();

        if ($existingQuestion) {
            $dbQuestionId = (int)$existingQuestion['question_id'];
        } else {
            if ($category === '') {
                $category = 'General';
            }

            $insertQuestion->bind_param('ss', $questionText, $category);
            if (!$insertQuestion->execute()) {
                throw new Exception('Failed to insert question: ' . $db->error);
            }
            $dbQuestionId = (int)$db->insert_id;
        }

        $insertResponse->bind_param('iiis', $studentId, $dbQuestionId, $rating, $responseText);
        if (!$insertResponse->execute()) {
            throw new Exception('Failed to insert response: ' . $db->error);
        }
    }

    $selectQuestion->close();
    $insertQuestion->close();
    $insertResponse->close();

    $tvlSubtracks = derive_tvl_subtracks($responses);

    $tieResolution = resolve_tie($weightedScores, $partScores, $tvlSubtracks);
    $selectedStrandCode = $tieResolution['selected'];
    $selectedScore = (float)$weightedScores[$selectedStrandCode];
    $band = score_band($selectedScore);

    $maxWeightedScore = 54.0;
    $confidence = round(($selectedScore / $maxWeightedScore) * 100, 2);

    $insertResult = $db->prepare('INSERT INTO assessment_results (student_id, assessment_id, domain, score) VALUES (?, ?, ?, ?)');
    foreach ($weightedScores as $strandCode => $score) {
        $scoreValue = round((float)$score, 2);
        $insertResult->bind_param('iisd', $studentId, $assessmentId, $strandCode, $scoreValue);
        $insertResult->execute();
    }
    $insertResult->close();

    $modelName = 'ANN Weighted Strand Rubric v1';
    $algorithmType = 'Artificial Neural Network (weighted rubric bootstrap)';
    $stmt = $db->prepare('SELECT model_id FROM ai_models WHERE model_name = ? LIMIT 1');
    $stmt->bind_param('s', $modelName);
    $stmt->execute();
    $model = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($model) {
        $modelId = (int)$model['model_id'];
    } else {
        $stmt = $db->prepare('INSERT INTO ai_models (model_name, algorithm_type) VALUES (?, ?)');
        $stmt->bind_param('ss', $modelName, $algorithmType);
        $stmt->execute();
        $modelId = (int)$db->insert_id;
        $stmt->close();
    }

    $stmt = $db->prepare('SELECT strand_id FROM strands WHERE strand_code = ? LIMIT 1');
    $stmt->bind_param('s', $selectedStrandCode);
    $stmt->execute();
    $selectedStrand = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($selectedStrand) {
        $recommendedStrandId = (int)$selectedStrand['strand_id'];
    } else {
        $strandName = $strands[$selectedStrandCode]['name'] ?? $selectedStrandCode;
        $description = 'Auto-created strand profile from rubric model.';
        $stmt = $db->prepare('INSERT INTO strands (strand_code, strand_name, description) VALUES (?, ?, ?)');
        $stmt->bind_param('sss', $selectedStrandCode, $strandName, $description);
        $stmt->execute();
        $recommendedStrandId = (int)$db->insert_id;
        $stmt->close();
    }

    $explanationPayload = [
        'rubric_version' => 'v1',
        'part_weights' => [
            'Part I' => 1.5,
            'Part II' => 2.0,
            'Part III' => 1.5,
            'Part IV' => 1.0
        ],
        'max_weighted_score' => $maxWeightedScore,
        'raw_scores' => $rawScores,
        'weighted_scores' => $weightedScores,
        'part_scores' => $partScores,
        'tvl_subtracks' => $tvlSubtracks,
        'tie_resolution' => $tieResolution,
        'score_band' => $band
    ];

    $decisionBasis = implode(' ', $tieResolution['decision_path']) . ' Final score band: ' . $band['strength_level'] . '.';
    $explanationText = json_encode($explanationPayload, JSON_UNESCAPED_UNICODE);

    $stmt = $db->prepare('INSERT INTO recommendations (student_id, model_id, recommended_strand_id, confidence_score, external_factors_considered, final_decision_basis, explanation_text) VALUES (?, ?, ?, ?, FALSE, ?, ?)');
    $stmt->bind_param('iiidss', $studentId, $modelId, $recommendedStrandId, $confidence, $decisionBasis, $explanationText);
    $stmt->execute();
    $recommendationId = (int)$db->insert_id;
    $stmt->close();

    $db->commit();

    json_response(201, [
        'success' => true,
        'message' => 'Survey saved and weighted ANN-ready recommendation generated.',
        'data' => [
            'recommendation_id' => $recommendationId,
            'selected_strand' => $selectedStrandCode,
            'confidence' => $confidence,
            'weighted_scores' => $weightedScores,
            'raw_scores' => $rawScores,
            'tvl_subtracks' => $tvlSubtracks,
            'score_band' => $band,
            'tie_resolution' => $tieResolution
        ]
    ]);
} catch (Throwable $e) {
    if (isset($db) && $db instanceof mysqli) {
        try {
            $db->rollback();
        } catch (Throwable $rollbackErr) {
            // Ignore rollback errors.
        }
    }

    error_log('Submit survey error: ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());

    json_response(500, [
        'success' => false,
        'message' => 'Failed to save survey responses: ' . $e->getMessage(),
        'error' => $e->getMessage(),
        'trace' => (defined('DEBUG') && (bool)constant('DEBUG')) ? $e->getTraceAsString() : null
    ]);
}
