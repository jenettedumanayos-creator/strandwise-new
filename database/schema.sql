-- StrandWise database schema
-- Import in phpMyAdmin: strandwise database -> Import -> select this file

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS school_strand_availability;
DROP TABLE IF EXISTS student_external_factors;
DROP TABLE IF EXISTS interview_feedback;
DROP TABLE IF EXISTS recommendations;
DROP TABLE IF EXISTS ai_training_runs;
DROP TABLE IF EXISTS ai_models;
DROP TABLE IF EXISTS survey_responses;
DROP TABLE IF EXISTS survey_questions;
DROP TABLE IF EXISTS assessment_results;
DROP TABLE IF EXISTS assessments;
DROP TABLE IF EXISTS academic_records;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS strands;
DROP TABLE IF EXISTS schools;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE schools (
    school_id INT AUTO_INCREMENT PRIMARY KEY,
    school_name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NULL,
    type VARCHAR(50) NULL,
    UNIQUE KEY uk_school_name (school_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE strands (
    strand_id INT AUTO_INCREMENT PRIMARY KEY,
    strand_code VARCHAR(10) NOT NULL UNIQUE,
    strand_name VARCHAR(150) NOT NULL,
    description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE admins (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    permissions JSON NULL,
    last_login DATETIME NULL,
    last_ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    updated_at DATETIME NULL,
    CONSTRAINT fk_admins_created_by FOREIGN KEY (created_by) REFERENCES admins(admin_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME NULL,
    CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender VARCHAR(20) NULL,
    date_of_birth DATE NULL,
    grade_level VARCHAR(10) NOT NULL,
    expressed_strand_id INT NULL,
    expressed_strand_source VARCHAR(20) NULL,
    CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_students_expressed_strand FOREIGN KEY (expressed_strand_id) REFERENCES strands(strand_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE academic_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(10) NOT NULL,
    final_grade DECIMAL(5,2) NULL,
    school_year VARCHAR(15) NOT NULL,
    CONSTRAINT fk_academic_records_student FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE assessments (
    assessment_id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE assessment_results (
    result_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    assessment_id INT NOT NULL,
    domain VARCHAR(100) NOT NULL,
    score DECIMAL(8,2) NOT NULL,
    date_taken DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assessment_results_student FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_assessment_results_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(assessment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE survey_questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    question_text TEXT NOT NULL,
    category VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE survey_responses (
    response_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    question_id INT NOT NULL,
    rating INT NULL,
    response_text TEXT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_survey_responses_student FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_survey_responses_question FOREIGN KEY (question_id) REFERENCES survey_questions(question_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ai_models (
    model_id INT AUTO_INCREMENT PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    algorithm_type VARCHAR(100) NOT NULL,
    training_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accuracy_score DECIMAL(5,2) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ai_training_runs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recommendations (
    recommendation_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    model_id INT NOT NULL,
    recommended_strand_id INT NOT NULL,
    confidence_score DECIMAL(5,2) NULL,
    external_factors_considered BOOLEAN NOT NULL DEFAULT FALSE,
    final_decision_basis TEXT NULL,
    explanation_text TEXT NULL,
    date_generated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recommendations_student FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_recommendations_model FOREIGN KEY (model_id) REFERENCES ai_models(model_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_recommendations_strand FOREIGN KEY (recommended_strand_id) REFERENCES strands(strand_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE interview_feedback (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    feedback_text TEXT NOT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_interview_feedback_user FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE student_external_factors (
    factor_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL UNIQUE,
    financial_capacity VARCHAR(50) NULL,
    financial_notes TEXT NULL,
    parental_expectation_strand VARCHAR(100) NULL,
    parental_influence_level VARCHAR(20) NULL,
    peer_influence_strand VARCHAR(100) NULL,
    peer_influence_level VARCHAR(20) NULL,
    other_factors TEXT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_external_factors_student FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE school_strand_availability (
    availability_id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    strand_id INT NOT NULL,
    capacity INT NULL,
    current_enrollment INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    school_year VARCHAR(15) NOT NULL,
    CONSTRAINT fk_school_strand_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_school_strand_strand FOREIGN KEY (strand_id) REFERENCES strands(strand_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    UNIQUE KEY uk_school_strand_year (school_id, strand_id, school_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_admins_role ON admins(role);
CREATE INDEX idx_admins_status ON admins(status);
CREATE INDEX idx_students_grade ON students(grade_level);
CREATE INDEX idx_assessment_results_student ON assessment_results(student_id);
CREATE INDEX idx_assessment_results_date ON assessment_results(date_taken);
CREATE INDEX idx_recommendations_student ON recommendations(student_id);
CREATE INDEX idx_school_availability_year ON school_strand_availability(school_year);

-- Starter seed data
INSERT INTO strands (strand_code, strand_name, description) VALUES
('STEM', 'Science, Technology, Engineering and Mathematics', 'Focuses on science, technology, engineering, and mathematics disciplines.'),
('ABM', 'Accountancy, Business and Management', 'Prepares students for business, entrepreneurship, and finance tracks.'),
('HUMSS', 'Humanities and Social Sciences', 'For students interested in communication, social sciences, and public service.'),
('TVL', 'Technical-Vocational-Livelihood', 'For hands-on learners focusing on practical skills, livelihood, and TESDA pathways.'),
('GAS', 'General Academic Strand', 'Flexible strand for students still exploring college options.')
ON DUPLICATE KEY UPDATE strand_name = VALUES(strand_name), description = VALUES(description);

INSERT INTO assessments (assessment_name, description)
VALUES ('Strand Interest & Aptitude Survey', 'Baseline assessment combining interest and perceived skill indicators.')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO admins (first_name, last_name, email, password_hash, role, status, permissions, updated_at)
VALUES (
    'System',
    'Admin',
    'admin@gmail.com',
    '$2y$10$iURCCaBioX5asJHklEJPuu/uDXFkkba8fxhTndYt43Gk6MdYAwGsW',
    'admin',
    'active',
    JSON_OBJECT('can_retrain_ai', true, 'can_edit_strands', true, 'can_manage_users', true),
    CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
    first_name = VALUES(first_name),
    last_name = VALUES(last_name),
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    status = VALUES(status),
    permissions = VALUES(permissions),
    updated_at = CURRENT_TIMESTAMP;
