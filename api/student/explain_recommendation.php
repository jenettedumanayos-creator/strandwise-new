<?php
require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

function interpret_part_score($part_key, $strand_scores, $max_part_weight) {
    $interpretations = [
        'part1' => [
            'label' => 'Academic Interests & Strengths',
            'description' => 'Reflects your strongest subject areas and academic abilities.',
            'strands_match' => [
                'STEM' => 'Strong in science/math concepts and technical thinking',
                'ABM' => 'Strong in analytical and business problem-solving',
                'HUMSS' => 'Strong in writing, communication, and analysis',
                'TVL' => 'Strong in hands-on and practical problem-solving',
                'GAS' => 'Interested in exploring multiple academic paths'
            ]
        ],
        'part2' => [
            'label' => 'Career Goals & Future Plans',
            'description' => 'Your stated aspirations align with specific career pathways.',
            'strands_match' => [
                'STEM' => 'Career goals in engineering, tech, or sciences',
                'ABM' => 'Career goals in business, finance, or entrepreneurship',
                'HUMSS' => 'Career goals in education, social work, or communication',
                'TVL' => 'Career goals in trades, vocational skills, or service industries',
                'GAS' => 'Career goals still being explored or interdisciplinary'
            ]
        ],
        'part3' => [
            'label' => 'Personality & Work Style',
            'description' => 'Your preferred way of working and learning matches strand characteristics.',
            'strands_match' => [
                'STEM' => 'You prefer analytical, systematic, and methodical work',
                'ABM' => 'You prefer collaborative, organized, and results-driven work',
                'HUMSS' => 'You prefer creative, communicative, and people-oriented work',
                'TVL' => 'You prefer practical, hands-on, and independent work',
                'GAS' => 'Your work style fits multiple or evolving approaches'
            ]
        ],
        'part4' => [
            'label' => 'Family Background & Finances',
            'description' => 'Your circumstances support feasibility of this strand\'s pathway.',
            'strands_match' => [
                'STEM' => 'Pathway accessible within your financial/family context',
                'ABM' => 'Pathway accessible within your financial/family context',
                'HUMSS' => 'Pathway accessible within your financial/family context',
                'TVL' => 'Strong fit given practical/financial constraints; shorter pathway to employment',
                'GAS' => 'Flexible pathway supports your current circumstances'
            ]
        ]
    ];

    $part_interpretation = $interpretations[$part_key] ?? null;
    if (!$part_interpretation) {
        return null;
    }

    $top_strands = [];
    arsort($strand_scores);
    foreach (array_slice($strand_scores, 0, 2) as $strand => $score) {
        if ($score > 0) {
            $top_strands[] = [
                'strand' => $strand,
                'score' => round($score, 2),
                'interpretation' => $part_interpretation['strands_match'][$strand] ?? 'No specific interpretation'
            ];
        }
    }

    return [
        'part_key' => $part_key,
        'label' => $part_interpretation['label'],
        'description' => $part_interpretation['description'],
        'top_strand_matches' => $top_strands,
        'explanation' => implode(' ', array_column(
            array_slice($strand_scores, 0, 1),
            function($score, $strand) use ($part_interpretation) {
                return $part_interpretation['strands_match'][$strand] ?? '';
            }
        ))
    ];
}

function strength_interpretation($band_info) {
    $strength = $band_info['strength_level'];
    $interpretations = [
        'Strong Match' => 'This strand is highly aligned with your profile. You show clear and consistent indicators across multiple dimensions.',
        'Moderate Match' => 'This strand is a good fit with your profile. There are positive indicators, though some areas show mixed signals.',
        'Weak Match' => 'This strand is possible but not ideal. You may succeed, but consider exploring other options in counseling.',
        'Poor Match' => 'This strand does not align well with your profile. Stronger alternatives are recommended.'
    ];

    return [
        'strength_level' => $strength,
        'interpretation' => $interpretations[$strength] ?? 'Assessment pending.',
        'score_range' => $band_info['range']
    ];
}

try {
    $auth = require_role('student');
    $db = get_db_connection();

    $stmt = $db->prepare('SELECT student_id FROM students WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $auth['user_id']);
    $stmt->execute();
    $student = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$student) {
        json_response(404, [
            'success' => false,
            'message' => 'Student profile not found'
        ]);
    }

    $studentId = (int)$student['student_id'];

    $recommendationSql = 'SELECT r.explanation_text, r.confidence_score, r.final_decision_basis, r.date_generated,
                                 s.strand_code, s.strand_name,
                                 m.model_name, m.algorithm_type
                          FROM recommendations r
                          INNER JOIN strands s ON s.strand_id = r.recommended_strand_id
                          INNER JOIN ai_models m ON m.model_id = r.model_id
                          WHERE r.student_id = ?
                          ORDER BY r.date_generated DESC, r.recommendation_id DESC
                          LIMIT 1';
    $stmt = $db->prepare($recommendationSql);
    $stmt->bind_param('i', $studentId);
    $stmt->execute();
    $recommendation = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$recommendation) {
        json_response(404, [
            'success' => false,
            'message' => 'No recommendations found for this student'
        ]);
    }

    $explanation_data = json_decode((string)$recommendation['explanation_text'], true) ?? [];

    $part_explanations = [];
    $part_keys = ['part1', 'part2', 'part3', 'part4'];
    foreach ($part_keys as $part_key) {
        $part_scores = $explanation_data['part_scores'][$part_key]['weighted'] ?? [];
        if (!empty($part_scores)) {
            $part_explanations[] = interpret_part_score($part_key, $part_scores, 
                $explanation_data['part_weights'][ucfirst(str_replace('part', 'Part ', $part_key))] ?? 1.0);
        }
    }

    $band = $explanation_data['score_band'] ?? ['strength_level' => 'Unknown', 'range' => '0-54'];
    $strength = strength_interpretation($band);

    $tie_info = $explanation_data['tie_resolution'] ?? [];
    $decision_path = [];
    if (!empty($tie_info['decision_path'])) {
        $decision_path = $tie_info['decision_path'];
    }

    $tvl_details = [];
    if (!empty($explanation_data['tvl_subtracks'])) {
        $tvl = $explanation_data['tvl_subtracks'];
        $tvl_details = [
            'ict' => [
                'name' => 'Information & Communication Technology',
                'score' => $tvl['ICT']['score'] ?? 0,
                'percent' => $tvl['ICT']['percent'] ?? 0,
                'careers' => 'Programming, web development, cybersecurity, IT support, robotics'
            ],
            'cookery' => [
                'name' => 'Culinary & Hospitality',
                'score' => $tvl['Cookery']['score'] ?? 0,
                'percent' => $tvl['Cookery']['percent'] ?? 0,
                'careers' => 'Chef, baker, caterer, hotel management, food service'
            ],
            'industrial' => [
                'name' => 'Industrial & Mechanical',
                'score' => $tvl['Industrial']['score'] ?? 0,
                'percent' => $tvl['Industrial']['percent'] ?? 0,
                'careers' => 'Technician, electrician, mechanic, carpenter, operator, farmer'
            ]
        ];
    }

    $all_scores = $explanation_data['weighted_scores'] ?? [];
    arsort($all_scores);
    $score_ranking = [];
    foreach ($all_scores as $strand => $score) {
        $score_ranking[] = [
            'strand' => $strand,
            'score' => round((float)$score, 2),
            'percent' => round(((float)$score / ($explanation_data['max_weighted_score'] ?? 54)) * 100, 1)
        ];
    }

    json_response(200, [
        'success' => true,
        'message' => 'Detailed explanation generated',
        'data' => [
            'recommendation' => [
                'strand' => $recommendation['strand_code'],
                'strand_name' => $recommendation['strand_name'],
                'confidence' => round((float)$recommendation['confidence_score'], 2) . '%',
                'generated_at' => $recommendation['date_generated'],
                'model' => [
                    'name' => $recommendation['model_name'],
                    'algorithm' => $recommendation['algorithm_type']
                ]
            ],
            'strength_assessment' => $strength,
            'part_analysis' => $part_explanations,
            'score_ranking' => $score_ranking,
            'tvl_subtracks' => $tvl_details,
            'decision_path' => $decision_path,
            'requires_counselor_review' => (bool)($tie_info['requires_counselor_override'] ?? false),
            'final_decision_basis' => $recommendation['final_decision_basis'] ?? null
        ]
    ]);
} catch (Throwable $e) {
    json_response(500, [
        'success' => false,
        'message' => 'Failed to generate explanation',
        'error' => $e->getMessage()
    ]);
}
