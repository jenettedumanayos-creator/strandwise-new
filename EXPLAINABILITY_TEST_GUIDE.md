# StrandWise AI Explainability Integration - Test & Validation Guide

## Overview
This document walks through testing the newly integrated explainability features for the AI recommendation system.

### Key Feature: Automatic Model Training
The system now trains its AI model **automatically** when students submit assessments. No manual admin action is required.

**Auto-Training Triggers:**
- ≥5 new assessments since last training, OR
- ≥6 hours have passed since last training
- Minimum thresholds met (10+ total recommendations, 3+ strands, 50+ weighted rows)

**What this means for users:**
- Students submit assessments → System immediately uses assessment data to generate recommendations
- Model automatically improves in background as more data accumulates
- Next set of students get more accurate recommendations from improved model
- Admins no longer need to manually trigger training
- "Force Train" button available in admin dashboard for manual override if needed

---

### Backend Components
1. **`/api/student/submit_survey.php`** - Assessment submission with weighted scoring + triggers auto-training
2. **`/api/admin/auto_train.php`** - NEW Automatic training engine (called after assessments)
3. **`/api/student/explain_recommendation.php`** - Detailed explainability backend (NEW)
4. **`/api/admin/decision_paths.php`** - Admin decision path review API (NEW)

---

## Auto-Training Flow

```
Student submits assessment
    ↓
Recommendations generated with explanation
    ↓
trigger_auto_training_async() called (non-blocking)
    ↓
/api/admin/auto_train.php endpoint runs in background
    ↓
Check: (5+ new assessments since last training) OR (6+ hours elapsed)
    ↓
If threshold met: Train new model, save accuracy score
    ↓
Next student gets results from latest trained model
```

**Auto-Training Thresholds:**
- Minimum 10 total recommendations across all students
- At least 3 different strands (out of 5) represented
- At least 50 weighted assessment rows (5 domains × students)

---

### Backend Components Detail
1. **`/api/student/submit_survey.php`** - Assessment submission with weighted scoring
2. **`/api/student/explain_recommendation.php`** - Detailed explainability backend (NEW)
3. **`/api/admin/decision_paths.php`** - Admin decision path review API (NEW)

### Frontend Components
1. **`main.js`** - Enhanced results display with:
   - `fetchDetailedExplanation()` - Fetches explainability data
   - `renderPartAnalysis()` - Renders rubric part breakdown
   - `renderScoreRanking()` - Renders strand ranking visualization
   - `renderTvlSubtracks()` - Renders TVL sub-track details
   - `renderDecisionPath()` - Renders decision journey
   - `displayDetailedExplanation()` - Main renderer

2. **`admin.js`** - Admin quality review with:
   - `loadDecisionPaths()` - Fetches filtered decision paths
   - `viewDecisionDetails()` - Shows detailed path for one student
   - `exportDecisionPaths()` - Exports data to CSV

### Database Tables Used
- `recommendations` - Stores recommendation records with explanation_text as JSON
- `assessment_results` - Stores weighted domain scores
- `ai_models` - Stores model metadata

---

## Testing Workflow

### Phase 1: Prerequisites ✓
- [ ] MySQL database is running and schema.sql has been imported
- [ ] XAMPP PHP is operational
- [ ] Browser developer console is open for debugging

### Phase 2: Basic System Health
```bash
# Verify API health check
curl http://localhost/strandwise/api/health.php
# Expected: {"success":true,"message":"API is healthy","data":{"db":"connected"}}
```

### Phase 3: Student Registration & Authentication
1. Open `http://localhost/strandwise/login.html` in browser
2. Click "Register" to create a test student account:
   - **Email:** `student.test@example.com`
   - **Password:** `TestPass123`
   - **First Name:** Jane
   - **Last Name:** Doe
   - **School:** Test High School
   - **Grade:** 11
3. After registration, login with same credentials
4. Verify you're redirected to `main.html` (student dashboard)

### Phase 4: Submit Assessment & Verify Basic Results
1. Click "New Assessment" on main.html
2. Complete all 35 survey questions:
   - **Part I (Q1-10):** Academic Interests – select desired strand options
   - **Part II (Q11-20):** Career Goals – select career-aligned strand options
   - **Part III (Q21-28):** Personality/Work Style – select personality-matched strand
   - **Part IV (Q29-35):** Family Background – select feasibility-aligned strand
3. Click "Submit Assessment"
4. Expected response: "Assessment submitted successfully!"
5. Wait for page to auto-display results
6. **Verify basic results show:**
   - Domain scores (STEM, ABM, HUMSS, TVL, GAS) with percentages
   - Top recommendation strand
   - TVL sub-tracks (if TVL was selected)

### Phase 5: Validate Detailed Explainability
1. After results appear, scroll down to **"How We Analyzed Your Profile"** section
2. **Verify Part Analysis shows:**
   - Part I: Academic Interests & Strengths (with top 1-2 strands and interpretations)
   - Part II: Career Goals & Future Plans (with top 1-2 strands)
   - Part III: Personality & Work Style (with top 1-2 strands)
   - Part IV: Family Background & Finances (with top 1-2 strands)

3. **Verify Strand Match Ranking shows:**
   - All 5 strands ranked by score (🥇🥈🥉 for top 3)
   - Score points and percentages for each strand
   - Example: "STEM: 26 pts (48%)" or similar

4. **If TVL was recommended, verify TVL Sub-Track Breakdown shows:**
   - ICT (Information & Communication Technology) with career examples
   - Cookery (Culinary & Hospitality) with career examples
   - Industrial (Industrial & Mechanical) with career examples
   - Each with percentage allocation and career field descriptions

5. **Verify Decision Logic section shows:**
   - Steps taken to reach final recommendation
   - Example paths:
     - "No tie detected." (clear winner)
     - "Special case STEM & ABM resolved using Part I dominance."
     - "Step 1: Part II (Career Goals) dominance resolved the tie."
   - If tie-breaker required: ⚠️ yellow warning box with "Counselor Review Recommended"

6. **Verify Strength Assessment shows:**
   - One of: "Strong Match", "Moderate Match", "Weak Match", "Poor Match"
   - Interpretation describing the assessment quality
   - Score range (e.g., "40-54")

### Phase 6: Admin Quality Review
1. Open `admin.html` in same or incognito browser tab
2. Login as admin:
   - **Email:** `admin@gmail.com`
   - **Password:** `administrator`
3. Navigate to **"Quality Review"** section (new tab in admin sidebar)
4. **Verify page shows:**
   - Filter controls: Strand dropdown, Min Confidence input, Requires Review checkbox
   - "Apply Filters" and "Export CSV" buttons
   - Decision paths table with columns:
     - Student name & email
     - Recommended strand
     - Confidence %
     - Requires Review status (✓ or ⚠️)
     - "View Details" button for each row

5. **Test filtering:**
   - Filter by "TVL" strand – table should show only TVL recommendations
   - Set Min Confidence to 70% – should filter to high-confidence recommendations
   - Check "Requires Review: Yes" – should show only flagged recommendations

6. **Test "View Details":**
   - Click "View Details" for a student row
   - Modal should display:
     - Student info
     - Recommended strand & name
     - Confidence score
     - Generated date
     - Assessment strength
     - Requires counselor review status
     - Decision path (bullet list)
     - Final decision basis
     - TVL subtracks (if applicable)
   - Example output:
     ```
     Student: Jane Doe (student.test@example.com)
     Recommended Strand: TVL - Technical-Vocational-Livelihood
     Confidence Score: 85%
     Generated: 4/15/2026, 10:30 AM
     Assessment Strength: Strong Match
     Requires Counselor Review: No
     Decision Path:
     • No tie detected.
     Final Decision Basis:
     Special case STEM & ABM resolved using Part I dominance. Final score band: Strong Match.
     TVL Sub-tracks:
     ICT: 45%
     Cookery: 25%
     Industrial: 30%
     ```

7. **Test Export CSV:**
   - Click "Export CSV"
   - Browser should download `decision_paths_YYYY-MM-DD.csv`
   - Verify file contains headers: Student Name, Email, Recommended Strand, Confidence, Requires Review, Date Generated
   - Verify student row is present with correct data

### Phase 7: Edge Cases & Error Handling
1. **No recommendations yet:**
   - Create new student account
   - Try to view results without submitting assessment
   - Expected: "No recommendations found" message

2. **Manually test API endpoints:**
   ```bash
   # Fetch latest explanation (must be logged in; uses session cookies)
   curl -b "cookies.txt" http://localhost/strandwise/api/student/explain_recommendation.php
   
   # Fetch admin decision paths (must be logged in as admin)
   curl -b "cookies.txt" http://localhost/strandwise/api/admin/decision_paths.php?limit=5&strand=STEM
   ```

3. **Test pagination:**
   - If > 10 decision paths exist, verify pagination controls appear
   - Click "Next" page button
   - Verify new set of 10 records loads

### Phase 8: Automatic Model Training
1. Submit an assessment as a student (Phase 4)
2. Go to admin dashboard
3. Navigate to **Dashboard** section
4. Scroll to **"AI Training Progress"** card
5. **Verify auto-training status:**
   - Green box appears: "✓ Auto-Training Enabled"
   - Button shows "⚡ Force Train" (not "Start Training")
   - Run status shows: "Last auto run: completed..."
6. **Why auto-training triggered:**
   - If this is your first assessment: waits for 5 assessments total
   - If 5+ assessments exist: may have auto-trained after your submission or will within next submission
   - Thresholds: Auto-trains on ≥5 new assessments OR ≥6 hours since last training
7. Submit 4 more assessments from different student accounts
8. After 5th assessment: model should auto-train (check dashboard)
9. Verify in admin "Last run" shows: "🤖 Last auto run: completed..."

### Phase 9: Auto-Training Verification (Optional)

## Validation Checklist

### Frontend (Student)
- [ ] Submit assessment with all 35 questions answered
- [ ] Results page displays basic domain scores and top recommendation
- [ ] Detailed explanation section is visible after results
- [ ] Part Analysis shows all 4 parts with relevant strands
- [ ] Strand Match Ranking displays all 5 strands with rankings
- [ ] TVL Sub-Tracks appear if TVL was recommended
- [ ] Decision Logic shows reasoning steps
- [ ] Assessment Strength displays with interpretation
- [ ] Tie-breaker warnings appear when required
- [ ] No JavaScript errors in console

### Admin (Quality Review)
- [ ] Admin can access Quality Review section
- [ ] Filter by strand works correctly
- [ ] Filter by min confidence works correctly
- [ ] Filter by requires review works correctly
- [ ] Pagination loads additional pages
- [ ] View Details modal shows all explanation data
- [ ] Export CSV downloads with correct format
- [ ] Data in admin view matches student view

### Database & API
- [ ] explanation_text JSON is stored correctly in recommendations table
- [ ] GET /student/explain_recommendation.php returns 200 with full data
- [ ] GET /admin/decision_paths.php returns 200 with paginated data
- [ ] Filters work correctly on API level
- [ ] Error responses are appropriate for missing data

### Explainability Quality
- [ ] Part interpretations are human-readable and relevant
- [ ] Decision path explains tie-breaking logic clearly
- [ ] Confidence scores align with weighted rubric scores
- [ ] TVL subtracks match survey response keywords
- [ ] Counselor review flags appear for ambiguous cases

---

## Troubleshooting

### Issue: "No detailed explanation available" console warning
**Solution:** Verify explain_recommendation.php API response:
```bash
curl -b "cookies.txt" -i http://localhost/strandwise/api/student/explain_recommendation.php
```
Expected: 200 OK with JSON data structure.

### Issue: Admin decision paths table is empty
**Solution:** 
- Verify at least one student has submitted assessment
- Check browser console for fetch errors
- Run: `curl http://localhost/strandwise/api/admin/decision_paths.php` (may need auth)

### Issue: TVL subtracks don't show
**Solution:**
- Verify student selected TVL in assessment (rating=4)
- Check explanation_text JSON for tvl_subtracks field
- Verify keywords in response_text match TVL keyword list

### Issue: Pagination controls missing
**Solution:**
- Need > 10 total recommendations to trigger pagination
- Create multiple student accounts and submit assessments
- Check pagination object in API response

---

## Performance Notes
- Explanation endpoint queries 1-2 database lookups (O(1))
- Decision paths API supports limit=1000 for bulk exports
- Part analysis rendering is client-side; expect <100ms on modern browsers
- No caching implemented; each request is fresh (can add Redis if needed)

---

## Future Enhancements
1. Add visualization charts for part score breakdown
2. Implement prediction confidence intervals
3. Add "Why not X strand?" counter-factual explanations
4. Enable counselor comments/annotations on decision paths
5. Create historical trend analysis for model accuracy
6. Add export to PDF with styled explanations
