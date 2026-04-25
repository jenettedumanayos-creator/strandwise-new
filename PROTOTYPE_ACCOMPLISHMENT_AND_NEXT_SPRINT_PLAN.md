# StrandWise Prototype Accomplishment and Next Sprint Plan

## Project Context
StrandWise is an AI-assisted strand recommendation prototype for SHS students. The prototype currently supports user authentication, assessment submission, recommendation generation, explainability outputs, and admin-side AI training monitoring.

Date prepared: April 25, 2026

## Core Feature Highlight
One of the core features of this system is explainable recommendations powered by an AI model. Instead of only showing a final strand output, the system presents supporting details such as weighted scores, confidence level, and decision path so students and evaluators can understand why a recommendation was produced.

## Current Prototype Status (for Panel Reporting)
- Prototype completion status: 60%
- Completed milestones: 3 out of 5
- Latest training run: Completed
- Latest recorded model accuracy: 77.67%
- Current labeled samples: 11
- Current class coverage: 5/5
- Current weighted rows: 55

### Milestone Snapshot
- Done: Class Coverage (5/5 strands represented)
- Done: Model Pipeline Initialized
- Done: Model Evaluated (accuracy saved)
- In Progress: Data Collection (11/30 labeled recommendations)
- In Progress: Feature Rows Ready (55/150 weighted rows)

## Accomplishments to Emphasize in Oral Defense
1. End-to-end prototype flow is operational.
- User can register/login, answer the assessment, and receive a recommendation.

2. Explainability is implemented.
- Recommendation output includes score breakdown and decision path support.

3. Admin intelligence workflow is active.
- Admin can monitor AI training progress and trigger force training.

4. Auto-training mechanism is integrated.
- Training can trigger automatically based on new data/time thresholds.

5. Database-backed tracking is in place.
- Training runs, metrics, and recommendation records are persisted and observable.

## Next Sprint Goal (Short-Term)
Goal: Raise prototype from 60% to 100% milestone completion before final defense.

### Required Data Targets
- Increase labeled recommendations from 11 to 30 (need +19)
- Increase weighted rows from 55 to 150 (need +95)

Practical estimate:
- One full assessment contributes approximately 1 recommendation and 5 weighted rows.
- Therefore, target is 19 additional completed student assessments.

## Next Sprint Task Plan
1. Data Collection Drive (Highest Priority)
- Run guided test sessions for at least 19 student respondents.
- Verify each submission is stored successfully.

2. Quality Validation
- Re-check recommendation outputs for consistency and explainability.
- Confirm no missing or malformed records in recommendation and assessment tables.

3. AI Training Validation
- Validate auto-training trigger behavior after data growth.
- Re-run force training and verify updated run history and metrics.

4. Documentation and Evidence Pack
- Prepare screenshots for login, assessment, result page, explainability view, and admin training card.
- Prepare one table summarizing before/after metrics.

5. Defense Readiness
- Prepare a 5-7 minute demo script.
- Prepare fallback demo accounts and pre-tested sample data.

## Risks and Mitigation
- Risk: Insufficient respondents before defense.
  - Mitigation: Conduct controlled internal test submissions using prepared test accounts.

- Risk: Last-minute regression bugs.
  - Mitigation: Freeze feature changes and allow only critical bug fixes.

- Risk: Demo interruptions.
  - Mitigation: Prepare backup screenshots and a recorded walkthrough.

## Expected Outcome by End of Next Sprint
- Prototype milestones at 5/5 (target: 100%)
- Stronger evidence base for panel evaluation
- Stable and defense-ready demonstration package
