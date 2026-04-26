const API_BASE = 'api';
let currentUser = null;
let latestResultsData = null;
let assessmentWizardInitialized = false;
let exploreCarouselsInitialized = false;
const ASSESSMENT_QUESTION_TOPICS = [
    'Favorite Subjects',
    'Problem Solving',
    'School Projects',
    'Numbers and Data',
    'Voluntary Activities',
    'Group Work',
    'Reading Choices',
    'Research and Writing',
    'Science Performance',
    'Seminar Choice',
    'Career Path',
    'Future Workplace',
    'College Plans',
    'Dream Job',
    'Community Impact',
    'Job Satisfaction',
    'Success Definition',
    'Career Preparation',
    'Skills to Build',
    'Alternative Path',
    'Work Preferences',
    'Learning Style',
    'Pressure Response',
    'Ideal Environment',
    'Self Expression',
    'Long-Term Projects',
    'Routine Tasks',
    'Ideal Self',
    'Family Expectations',
    'Financial Situation',
    'Family Livelihood',
    'Family Influence',
    'Loans or Scholarships',
    'Job Security',
    'Community Background'
];
const EXPLORE_CAROUSEL_DATA = [
    {
        targetId: 'academicExploreCarousel',
        label: 'Academic track',
        title: 'Explore the academic strands',
        subtitle: 'Use the arrows or dots to compare the core academic paths.',
        autoLabel: 'Auto-advancing',
        slides: [
            {
                strand: 'STEM strand',
                title: 'Science, Technology, Engineering and Mathematics',
                description: 'Build depth in scientific thinking, experimentation, and technical problem-solving.',
                pills: ['Biology', 'Chemistry', 'Physics', 'Mathematics'],
                roles: 'Doctor | Engineer | Researcher | Data specialist',
                cta: 'View key paths',
                image: 'img/carousel/stem1.jpg',
                accent: '#1a1060'
            },
            {
                strand: 'ABM strand',
                title: 'Accountancy, Business and Management',
                description: 'Strengthen decision-making, finance, entrepreneurship, and leadership skills.',
                pills: ['Accounting', 'Economics', 'Marketing', 'Business planning'],
                roles: 'Accountant | Entrepreneur | Manager | Analyst',
                cta: 'View key paths',
                image: 'img/carousel/business1.jpg',
                accent: '#0a2540'
            },
            {
                strand: 'HUMSS strand',
                title: 'Humanities and Social Sciences',
                description: 'Study people, culture, communication, and the forces that shape communities.',
                pills: ['Literature', 'History', 'Sociology', 'Public speaking'],
                roles: 'Teacher | Journalist | Lawyer | Community leader',
                cta: 'View key paths',
                image: 'img/carousel/school.jpg',
                accent: '#1a0a2e'
            },
            {
                strand: 'GAS strand',
                title: 'General Academic Strand',
                description: 'Keep your options open while building a broad and flexible academic foundation.',
                pills: ['Core subjects', 'Flexible electives', 'College prep', 'Multi-discipline'],
                roles: 'Flexible entry point for many college routes',
                cta: 'View key paths',
                image: 'img/carousel/stem3.jpg',
                accent: '#0f2e1a'
            }
        ]
    },
    {
        targetId: 'tvlExploreCarousel',
        label: 'TVL track',
        title: 'Explore the technical-vocational strands',
        subtitle: 'See the hands-on pathways designed for applied skills and early career readiness.',
        autoLabel: 'Auto-advancing',
        slides: [
            {
                strand: 'ICT strand',
                title: 'Information and Communications Technology',
                description: 'Learn programming, troubleshooting, networking, and modern digital systems.',
                pills: ['Programming', 'Networks', 'Web systems', 'Technical support'],
                roles: 'Developer | IT support | Network technician | QA assistant',
                cta: 'View key paths',
                image: 'img/carousel/ict1.jpg',
                accent: '#12263f'
            },
            {
                strand: 'Cookery strand',
                title: 'Cookery and Culinary Arts',
                description: 'Train in food preparation, kitchen operations, service standards, and hospitality.',
                pills: ['Food prep', 'Kitchen safety', 'Menu planning', 'Hospitality'],
                roles: 'Chef | Baker | Catering staff | Food entrepreneur',
                cta: 'View key paths',
                image: 'img/carousel/cooking.jpg',
                accent: '#3b190f'
            },
            {
                strand: 'Industrial Arts strand',
                title: 'Industrial Arts and Skilled Trades',
                description: 'Develop practical strengths in tools, repair work, fabrication, and technical systems.',
                pills: ['Electronics', 'Automotive', 'Electrical work', 'Fabrication'],
                roles: 'Technician | Electrician | Mechanic | Trade specialist',
                cta: 'View key paths',
                image: 'img/carousel/ict2.jpg',
                accent: '#1f2429'
            }
        ]
    }
];

function uiAlert(message, title = 'Notice') {
    if (window.AppUI?.alert) {
        return window.AppUI.alert(message, title);
    }
    alert(message);
    return Promise.resolve();
}

function uiToast(message, type = 'info') {
    if (window.AppUI?.toast) {
        window.AppUI.toast(message, type);
        return;
    }
    alert(message);
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    const rawText = await response.text();
    let data;

    try {
        data = rawText ? JSON.parse(rawText) : { success: false, message: 'Empty server response' };
    } catch (_err) {
        const preview = rawText.trim().slice(0, 180);
        data = {
            success: false,
            message: preview ? `Invalid server response: ${preview}` : 'Invalid server response'
        };
    }

    if (!response.ok || !data.success) {
        throw new Error(data.message || `Request failed (${response.status})`);
    }

    return data;
}

function persistSession(user) {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', (user.role || 'student').toLowerCase());
    localStorage.setItem('userEmail', user.email || '');
    localStorage.setItem('userName', fullName || user.email || 'User');
    localStorage.setItem('userSchool', user.school_name || '');
    localStorage.setItem('userGrade', user.grade_level || '');
    localStorage.setItem('userStudentId', user.student_id || '');
    localStorage.setItem('userCreatedAt', user.created_at || '');
    localStorage.setItem('userStatus', user.status || '');
}

function clearSessionStorage() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userSchool');
    localStorage.removeItem('userGrade');
    localStorage.removeItem('userType');
    localStorage.removeItem('userStudentId');
    localStorage.removeItem('userCreatedAt');
    localStorage.removeItem('userStatus');
}

function getProgressStorageKey() {
    const identity = currentUser?.user_id || localStorage.getItem('userEmail') || 'student';
    return `strandwiseProgress_${identity}`;
}

function getStoredProgress() {
    try {
        const raw = localStorage.getItem(getProgressStorageKey());
        if (!raw) {
            return { explored: false };
        }
        const parsed = JSON.parse(raw);
        return {
            explored: Boolean(parsed.explored)
        };
    } catch (_err) {
        return { explored: false };
    }
}

function setStoredProgress(patch) {
    const current = getStoredProgress();
    const next = { ...current, ...patch };
    localStorage.setItem(getProgressStorageKey(), JSON.stringify(next));
    return next;
}

function setResultsVisibility(hasResults) {
    const emptyState = document.getElementById('noResultsState');
    const academicTrackSection = document.getElementById('academicTrackSection');
    const tvlTrackSection = document.getElementById('tvlTrackSection');

    if (emptyState) {
        emptyState.style.display = hasResults ? 'none' : 'block';
    }

    if (academicTrackSection) {
        academicTrackSection.style.display = hasResults ? '' : 'none';
    }

    if (tvlTrackSection && !hasResults) {
        tvlTrackSection.style.display = 'none';
    }
}

function updateProgressUI(state = {}) {
    const hasResults = Boolean(state.hasResults);
    const explored = Boolean(state.explored);

    const completed = [
        true,
        hasResults,
        hasResults,
        explored
    ];

    const steps = Array.from(document.querySelectorAll('.progress-steps .progress-step'));
    const firstIncompleteIndex = completed.findIndex(flag => !flag);

    steps.forEach((step, index) => {
        const indicator = step.querySelector('.step-indicator');
        const isCompleted = completed[index];
        const isActive = !isCompleted && firstIncompleteIndex === index;

        step.classList.remove('completed', 'active');
        if (isCompleted) {
            step.classList.add('completed');
        } else if (isActive) {
            step.classList.add('active');
        }

        if (indicator) {
            indicator.textContent = isCompleted ? '✓' : String(index + 1);
        }
    });

    const completedCount = completed.filter(Boolean).length;
    const completionPercent = Math.round((completedCount / 4) * 100);

    const progressCircleValue = document.querySelector('.progress-percentage');
    if (progressCircleValue) {
        progressCircleValue.textContent = `${completionPercent}%`;
    }

    const completionCardValue = document.querySelector('.dashboard-grid .dashboard-item:nth-child(4) .card-value');
    if (completionCardValue) {
        completionCardValue.textContent = `${completionPercent}%`;
    }

    const assessmentStatusValue = document.querySelector('.dashboard-grid .dashboard-item:nth-child(1) .card-value');
    if (assessmentStatusValue) {
        if (hasResults) {
            assessmentStatusValue.textContent = 'Completed ✓';
            assessmentStatusValue.style.color = '#4caf50';
        } else {
            assessmentStatusValue.textContent = 'Pending';
            assessmentStatusValue.style.color = '';
        }
    }

    const profileStatus = document.getElementById('profileStatus');
    const profileCompletion = document.getElementById('profileCompletion');
    if (profileStatus) {
        profileStatus.textContent = hasResults ? 'Completed' : 'Not Started';
    }
    if (profileCompletion) {
        profileCompletion.textContent = `${completionPercent}%`;
    }
}

function applyResultsSummaryToDashboard(results) {
    const domainScores = results?.domain_scores || {};
    const matchesCount = Object.keys(domainScores).length;

    const matchesCardValue = document.querySelector('.dashboard-grid .dashboard-item:nth-child(3) .card-value');
    if (matchesCardValue) {
        matchesCardValue.textContent = String(matchesCount);
    }

    const topMatch = results?.top_recommendation?.strand || '-';

    const topMatchCardValue = document.querySelector('.dashboard-grid .dashboard-item:nth-child(2) .card-value');
    if (topMatchCardValue) {
        topMatchCardValue.textContent = topMatch;
    }

    const profileTopMatch = document.getElementById('profileTopMatch');
    const profileScore = document.getElementById('profileScore');
    if (profileTopMatch) {
        profileTopMatch.textContent = topMatch;
    }
    if (profileScore) {
        profileScore.textContent = results?.top_recommendation?.confidence || '-';
    }
}

async function syncProgressFromServer() {
    try {
        const response = await apiRequest('/student/get_results.php', { method: 'GET' });
        const results = response.data || {};
        const hasResults = Boolean(results.domain_scores && Object.keys(results.domain_scores).length > 0);
        const stored = getStoredProgress();

        latestResultsData = hasResults ? results : null;
        setResultsVisibility(hasResults);

        if (hasResults) {
            applyResultsSummaryToDashboard(results);
        }

        updateProgressUI({ hasResults, explored: stored.explored });
    } catch (_err) {
        const stored = getStoredProgress();
        setResultsVisibility(false);
        updateProgressUI({ hasResults: false, explored: stored.explored });
    }
}

async function checkAuth() {
    if (currentUser) {
        return true;
    }

    try {
        const me = await apiRequest('/auth/me.php', { method: 'GET' });
        currentUser = me.data;

        if ((currentUser.role || '').toLowerCase() === 'admin') {
            window.location.href = 'admin.html';
            return false;
        }

        persistSession(currentUser);
        return true;
    } catch (err) {
        clearSessionStorage();
        window.location.href = 'login.html';
        return false;
    }
}

// Navigation between pages
async function navigateToDashboard() {
    if (!(await checkAuth())) {
        return;
    }

    const landingPage = document.getElementById('landingPage');
    const dashboardPage = document.getElementById('dashboardPage');

    if (landingPage) {
        landingPage.classList.remove('active');
    }
    if (dashboardPage) {
        dashboardPage.classList.add('active');
    }

    scrollToTop();
    loadUserData();
    await syncProgressFromServer();
}

async function navigateToLanding() {
    try {
        await apiRequest('/auth/logout.php', { method: 'POST', body: JSON.stringify({}) });
    } catch (err) {
        // Continue local logout flow even if API call fails.
    }

    currentUser = null;
    clearSessionStorage();
    window.location.href = 'index.html';
}

function scrollToTop() {
    window.scrollTo(0, 0);
}

function formatProfileDate(dateValue) {
    if (!dateValue) {
        return 'Not available';
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
        return String(dateValue);
    }

    return parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatProfileStudentId(user) {
    const numericId = Number(user?.student_id || localStorage.getItem('userStudentId') || 0);
    if (!numericId) {
        return 'Not available';
    }

    const createdAt = user?.created_at || localStorage.getItem('userCreatedAt') || '';
    const parsed = createdAt ? new Date(createdAt) : null;
    const year = parsed && !Number.isNaN(parsed.getTime())
        ? parsed.getFullYear()
        : new Date().getFullYear();

    return `SW-${year}-${String(numericId).padStart(3, '0')}`;
}

function loadUserData() {
    const userName = currentUser
        ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
        : (localStorage.getItem('userName') || 'User');
    const userEmail = currentUser?.email || localStorage.getItem('userEmail') || 'user@example.com';
    const userSchool = currentUser?.school_name || localStorage.getItem('userSchool') || 'Example School';
    const userGrade = currentUser?.grade_level || localStorage.getItem('userGrade') || 'Grade 10';
    const userRole = (currentUser?.role || localStorage.getItem('userType') || 'student').toLowerCase();
    const userStatus = currentUser?.status || localStorage.getItem('userStatus') || 'active';
    const createdAt = currentUser?.created_at || localStorage.getItem('userCreatedAt') || '';
    const profileId = formatProfileStudentId(currentUser);
    const fullRoleLabel = userRole ? `${userRole.charAt(0).toUpperCase()}${userRole.slice(1)}` : 'Student';
    const statusLabel = userStatus ? `${userStatus.charAt(0).toUpperCase()}${userStatus.slice(1)}` : 'Active';

    const initials = userName
        .split(' ')
        .filter(Boolean)
        .map(name => name.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2) || 'U';

    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
        userAvatar.textContent = initials;
    }

    const profileAvatarMain = document.getElementById('profileAvatarMain');
    if (profileAvatarMain) {
        profileAvatarMain.setAttribute('aria-label', `${userName} profile avatar`);
        profileAvatarMain.setAttribute('title', userName);
    }

    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Hello, ${userName}! Welcome to your personal strand recommendation dashboard. This is your space to discover which academic strand aligns best with your interests, strengths, and career goals.`;
    }

    const profileNameHeader = document.getElementById('profileNameHeader');
    const profileTitleHeader = document.getElementById('profileTitleHeader');
    const profileIDHeader = document.getElementById('profileIDHeader');
    const profileDateHeader = document.getElementById('profileDateHeader');
    const profileStatusHeader = document.getElementById('profileStatusHeader');
    const profileNameDetail = document.getElementById('profileNameDetail');
    const profileEmailDetail = document.getElementById('profileEmailDetail');
    const profileGradeDetail = document.getElementById('profileGradeDetail');
    const profileSchoolDetail = document.getElementById('profileSchoolDetail');
    const profileRoleDetail = document.getElementById('profileRoleDetail');
    const profileCreatedDetail = document.getElementById('profileCreatedDetail');

    if (profileNameHeader) profileNameHeader.textContent = userName;
    if (profileTitleHeader) profileTitleHeader.textContent = `${userGrade} ${fullRoleLabel}`;
    if (profileIDHeader) profileIDHeader.textContent = profileId;
    if (profileDateHeader) profileDateHeader.textContent = formatProfileDate(createdAt);
    if (profileStatusHeader) profileStatusHeader.textContent = statusLabel;
    if (profileNameDetail) profileNameDetail.textContent = userName;
    if (profileEmailDetail) profileEmailDetail.textContent = userEmail;
    if (profileGradeDetail) profileGradeDetail.textContent = userGrade;
    if (profileSchoolDetail) profileSchoolDetail.textContent = userSchool;
    if (profileRoleDetail) profileRoleDetail.textContent = fullRoleLabel;
    if (profileCreatedDetail) profileCreatedDetail.textContent = formatProfileDate(createdAt);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.content-section');

navLinks.forEach(link => {
    link.addEventListener('click', function () {
        const sectionId = this.getAttribute('data-section');

        navLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');

        sections.forEach(section => section.classList.remove('active'));
        const section = document.getElementById(sectionId + '-section');
        if (section) {
            section.classList.add('active');
        }

        const titles = {
            home: 'Welcome Home',
            assessment: 'Take Assessment',
            results: 'Your Results',
            explore: 'Explore Strands',
            profile: 'Your Profile',
            about: 'About StrandWise',
            help: 'Help & Support'
        };
        const title = document.getElementById('sectionTitle');
        if (title) {
            title.textContent = titles[sectionId] || 'StrandWise';
        }

        if (sectionId === 'profile') {
            loadUserData();
        }

        if (sectionId === 'explore') {
            setStoredProgress({ explored: true });
            const hasResults = Boolean(latestResultsData?.domain_scores && Object.keys(latestResultsData.domain_scores).length > 0);
            updateProgressUI({ hasResults, explored: true });
        }

        if (sectionId === 'results') {
            const hasResults = Boolean(latestResultsData?.domain_scores && Object.keys(latestResultsData.domain_scores).length > 0);
            setResultsVisibility(hasResults);

            if (hasResults) {
                fetchAndDisplayResults();
            }
        }

        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('collapsed');
            }
        }
    });
});

function mapQuestionToCategory(questionNumber) {
    if (questionNumber <= 10) return 'Part I: Academic Interests & Strengths';
    if (questionNumber <= 20) return 'Part II: Career Goals & Future Plans';
    if (questionNumber <= 28) return 'Part III: Personality & Work Style';
    return 'Part IV: Family Background & Finances';
}

function mapOptionToDomain(optionIndex) {
    const domainMap = {
        0: 'Math',
        1: 'Business',
        2: 'Language',
        3: 'Practical',
        4: 'General'
    };

    return domainMap[optionIndex] || 'General';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getAssessmentQuestionTopic(questionNumber) {
    return ASSESSMENT_QUESTION_TOPICS[questionNumber - 1] || 'Assessment';
}

function getAssessmentQuestionTip(questionNumber) {
    if (questionNumber === 3) {
        return 'Think about projects you genuinely enjoyed, not just ones you were good at - both matter.';
    }

    if (questionNumber <= 10) {
        return 'Base your choice on the classwork and activities that naturally keep your attention.';
    }

    if (questionNumber <= 20) {
        return 'Choose the path that feels most motivating to grow into, even if you are still exploring.';
    }

    if (questionNumber <= 28) {
        return 'Answer based on your usual habits and strengths, not the version of yourself you feel pressured to show.';
    }

    return 'Be honest about family and financial realities so your recommendation stays practical and helpful.';
}

function syncQuestionSelectionState(card) {
    const options = card.querySelectorAll('.radio-option');
    options.forEach((option) => {
        const input = option.querySelector('input[type="radio"]');
        option.classList.toggle('is-selected', Boolean(input?.checked));
    });
}

function decorateAssessmentCard(card, index) {
    if (card.dataset.decorated === 'true') {
        syncQuestionSelectionState(card);
        return;
    }

    const questionNumber = index + 1;
    const title = card.querySelector('h4');

    if (title) {
        const cleanTitle = title.textContent.replace(/^\d+\.\s*/, '').replace(/\s+/g, ' ').trim();
        title.textContent = cleanTitle;

        const header = document.createElement('div');
        header.className = 'question-card-header';

        const symbol = document.createElement('div');
        symbol.className = 'question-card-symbol';
        symbol.setAttribute('aria-hidden', 'true');

        const label = document.createElement('div');
        label.className = 'question-card-label';
        label.textContent = `Question ${questionNumber} - ${getAssessmentQuestionTopic(questionNumber)}`;

        header.append(symbol, label);
        title.insertAdjacentElement('beforebegin', header);
    }

    const optionLabels = Array.from(card.querySelectorAll('.radio-option'));
    optionLabels.forEach((option, optionIndex) => {
        const input = option.querySelector('input[type="radio"]');
        if (!input) {
            return;
        }

        const optionText = option.textContent.replace(/\s+/g, ' ').trim();
        option.textContent = '';
        option.appendChild(input);

        const control = document.createElement('span');
        control.className = 'radio-option-control';
        control.setAttribute('aria-hidden', 'true');

        const letter = document.createElement('span');
        letter.className = 'radio-option-letter';
        letter.setAttribute('aria-hidden', 'true');
        letter.textContent = String.fromCharCode(65 + optionIndex);

        const text = document.createElement('span');
        text.className = 'radio-option-text';
        text.textContent = optionText;

        option.append(control, letter, text);
    });

    syncQuestionSelectionState(card);
    card.dataset.decorated = 'true';
}

function updateAssessmentProgressUI(currentIndex, totalQuestions) {
    const questionNumber = currentIndex + 1;
    const progressPercent = Math.max(1, Math.round((questionNumber / Math.max(totalQuestions, 1)) * 100));

    const counter = document.getElementById('assessmentQuestionCounter');
    const percent = document.getElementById('assessmentProgressPercent');
    const fill = document.getElementById('assessmentProgressFill');
    const tip = document.getElementById('assessmentTip');

    if (counter) {
        counter.textContent = `Q${questionNumber} of ${totalQuestions}`;
    }

    if (percent) {
        percent.textContent = `${progressPercent}%`;
    }

    if (fill) {
        fill.style.width = `${progressPercent}%`;
    }

    if (tip) {
        tip.textContent = getAssessmentQuestionTip(questionNumber);
    }
}

function collectAssessmentPayload() {
    const questionCards = document.querySelectorAll('#assessment-section .question-card');
    const responses = [];
    const domainScores = {
        Math: 0,
        Business: 0,
        Language: 0,
        Practical: 0,
        General: 0
    };

    for (let i = 0; i < questionCards.length; i += 1) {
        const card = questionCards[i];
        const questionNumber = i + 1;
        const questionName = `question${questionNumber}`;

        const options = Array.from(card.querySelectorAll(`input[name="${questionName}"]`));
        const selected = card.querySelector(`input[name="${questionName}"]:checked`);

        if (!selected) {
            return { error: `Please answer question ${questionNumber}.` };
        }

        const optionIndex = options.findIndex(opt => opt === selected);
        const optionLabel = selected.closest('label')?.textContent?.trim() || '';
        const questionText = card.querySelector('h4')?.textContent?.replace(/^\d+\.\s*/, '').trim() || `Question ${questionNumber}`;
        const domain = mapOptionToDomain(optionIndex);

        domainScores[domain] += 1;

        responses.push({
            question_id: questionNumber,
            question_text: questionText,
            category: mapQuestionToCategory(questionNumber),
            rating: optionIndex >= 0 ? optionIndex + 1 : null,
            response_text: optionLabel
        });
    }

    return {
        assessment_id: 1,
        responses,
        domain_scores: domainScores
    };
}

function initAssessmentWizard() {
    if (assessmentWizardInitialized) {
        return;
    }

    const assessmentSection = document.getElementById('assessment-section');
    if (!assessmentSection) {
        return;
    }

    const questionCards = Array.from(assessmentSection.querySelectorAll('.question-card'));
    const prevBtn = document.getElementById('assessmentPrevBtn');
    const actionBtn = document.getElementById('assessmentActionBtn');
    if (!questionCards.length || !actionBtn || !prevBtn) {
        return;
    }

    questionCards.forEach((card, index) => {
        decorateAssessmentCard(card, index);
    });

    const lastIndex = questionCards.length - 1;
    let currentIndex = 0;

    const hasAnswer = (index) => {
        const groupName = `question${index + 1}`;
        return Boolean(assessmentSection.querySelector(`input[name="${groupName}"]:checked`));
    };

    const updateButtonState = () => {
        actionBtn.textContent = currentIndex === lastIndex ? 'Submit Assessment' : 'Next';
        actionBtn.disabled = !hasAnswer(currentIndex);
        prevBtn.disabled = currentIndex === 0;
    };

    const showQuestion = (index) => {
        currentIndex = Math.max(0, Math.min(index, lastIndex));
        questionCards.forEach((card, idx) => {
            card.classList.toggle('active-question', idx === currentIndex);
        });
        syncQuestionSelectionState(questionCards[currentIndex]);
        updateAssessmentProgressUI(currentIndex, questionCards.length);
        updateButtonState();
        questionCards[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    actionBtn.addEventListener('click', async () => {
        if (actionBtn.disabled) {
            return;
        }

        if (currentIndex === lastIndex) {
            await submitAssessment();
            return;
        }

        showQuestion(currentIndex + 1);
    });

    prevBtn.addEventListener('click', () => {
        if (prevBtn.disabled) {
            return;
        }

        showQuestion(currentIndex - 1);
    });

    questionCards.forEach((card, index) => {
        const options = card.querySelectorAll('input[type="radio"]');
        options.forEach((option) => {
            option.addEventListener('change', () => {
                syncQuestionSelectionState(card);
                if (index !== currentIndex) {
                    return;
                }

                updateButtonState();
            });
        });
    });

    showQuestion(0);
    assessmentWizardInitialized = true;
}

function renderExploreCarousel(config) {
    const root = document.getElementById(config.targetId);
    if (!root || !Array.isArray(config.slides) || config.slides.length === 0) {
        return null;
    }

    root.innerHTML = `
        <div class="strand-carousel">
            <div class="strand-carousel-header">
                <span class="strand-carousel-label">${escapeHtml(config.label)}</span>
                <h3 class="strand-carousel-title">${escapeHtml(config.title)}</h3>
                <p class="strand-carousel-subtitle">${escapeHtml(config.subtitle)}</p>
            </div>

            <div class="strand-carousel-viewport">
                <div class="strand-carousel-track">
                    ${config.slides.map((slide, index) => `
                        <article class="strand-slide${index === 0 ? ' is-active' : ''}">
                            <div class="strand-slide-bg" style="background-color:${escapeHtml(slide.accent || '#111111')}; background-image:url('${escapeHtml(slide.image || '')}');"></div>
                            <div class="strand-slide-overlay"></div>
                            <div class="strand-slide-content">
                                <span class="strand-slide-badge">${escapeHtml(slide.strand)}</span>
                                <h4 class="strand-slide-title">${escapeHtml(slide.title)}</h4>
                                <p class="strand-slide-desc">${escapeHtml(slide.description)}</p>
                                <div class="strand-pills">
                                    ${(slide.pills || []).map((pill) => `<span class="strand-pill">${escapeHtml(pill)}</span>`).join('')}
                                </div>
                                <div class="strand-slide-footer">
                                    <button class="strand-slide-cta" type="button">${escapeHtml(slide.cta || 'Explore')}</button>
                                    <span class="strand-slide-roles">${escapeHtml(slide.roles || '')}</span>
                                </div>
                            </div>
                        </article>
                    `).join('')}
                </div>
            </div>

            <div class="strand-carousel-nav">
                <div class="strand-carousel-nav-left">
                    <div class="strand-carousel-dots">
                        ${config.slides.map((slide, index) => `
                            <button class="strand-carousel-dot${index === 0 ? ' is-active' : ''}" type="button" aria-label="Go to ${escapeHtml(slide.strand)}"></button>
                        `).join('')}
                    </div>
                    <span class="strand-carousel-status">${escapeHtml(config.autoLabel || 'Auto-advancing')}</span>
                </div>
                <div class="strand-carousel-controls">
                    <button class="strand-carousel-control" type="button" aria-label="Previous slide"><</button>
                    <button class="strand-carousel-control" type="button" aria-label="Next slide">></button>
                </div>
            </div>
        </div>
    `;

    return root;
}

function initExploreCarousels() {
    if (exploreCarouselsInitialized) {
        return;
    }

    const renderedRoots = EXPLORE_CAROUSEL_DATA
        .map((config) => ({ config, root: renderExploreCarousel(config) }))
        .filter((item) => item.root);

    if (!renderedRoots.length) {
        return;
    }

    renderedRoots.forEach(({ config, root }) => {
        const track = root.querySelector('.strand-carousel-track');
        const slides = Array.from(root.querySelectorAll('.strand-slide'));
        const dots = Array.from(root.querySelectorAll('.strand-carousel-dot'));
        const controls = Array.from(root.querySelectorAll('.strand-carousel-control'));

        if (!track || !slides.length || controls.length < 2) {
            return;
        }

        let currentIndex = 0;
        let timerId = null;

        const setSlide = (index) => {
            currentIndex = (index + slides.length) % slides.length;
            track.style.transform = `translateX(-${currentIndex * 100}%)`;

            slides.forEach((slide, slideIndex) => {
                slide.classList.toggle('is-active', slideIndex === currentIndex);
            });

            dots.forEach((dot, dotIndex) => {
                dot.classList.toggle('is-active', dotIndex === currentIndex);
                dot.setAttribute('aria-pressed', dotIndex === currentIndex ? 'true' : 'false');
            });
        };

        const startAutoPlay = () => {
            window.clearInterval(timerId);
            timerId = window.setInterval(() => {
                setSlide(currentIndex + 1);
            }, config.intervalMs || 4200);
        };

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                setSlide(index);
                startAutoPlay();
            });
        });

        controls[0].addEventListener('click', () => {
            setSlide(currentIndex - 1);
            startAutoPlay();
        });

        controls[1].addEventListener('click', () => {
            setSlide(currentIndex + 1);
            startAutoPlay();
        });

        root.addEventListener('mouseenter', () => {
            window.clearInterval(timerId);
        });

        root.addEventListener('mouseleave', () => {
            startAutoPlay();
        });

        setSlide(0);
        startAutoPlay();
    });

    exploreCarouselsInitialized = true;
}

async function fetchDetailedExplanation() {
    try {
        const response = await apiRequest('/student/explain_recommendation.php', { method: 'GET' });
        return response.data || null;
    } catch (err) {
        console.warn('Could not fetch detailed explanation:', err.message);
        return null;
    }
}

function renderPartAnalysis(part_analysis) {
    if (!Array.isArray(part_analysis) || part_analysis.length === 0) {
        return '';
    }

    let html = '<div class="explanation-parts" style="margin-top: 2rem;">';
    html += '<h4 style="margin-bottom: 1.5rem; color: var(--primary);">How We Analyzed Your Profile</h4>';

    part_analysis.forEach((part, idx) => {
        const maxPartScore = Math.max(...(part.top_strand_matches || []).map(m => parseFloat(m.score) || 0), 1);
        const partColors = ['#3B82F6', '#8B5CF6', '#EC4899'];
        
        html += `
        <div class="part-analysis" style="background: var(--bg-light); padding: 1.2rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid var(--primary);">
            <h5 style="color: var(--primary); margin-bottom: 0.5rem;">${part.label}</h5>
            <p style="color: var(--text-light); font-size: 0.95rem; margin-bottom: 1rem;">${part.description}</p>
            <div class="top-strand-matches" style="background: white; padding: 1rem; border-radius: 0.4rem;">
                ${(part.top_strand_matches || []).map((match, i) => {
                    const barPercent = (parseFloat(match.score) / maxPartScore) * 100;
                    const color = partColors[i % partColors.length];
                    const pctDisplay = barPercent > 25 ? '<span style="color: white; font-size: 0.75rem; font-weight: 600;">' + Math.round(barPercent) + '%</span>' : '';
                    const marginStyle = i === (part.top_strand_matches.length - 1) ? '0' : '1rem';
                    const justifyStyle = barPercent > 35 ? 'flex-end' : 'flex-start';
                    return '<div style="margin-bottom: ' + marginStyle + ';"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;"><strong style="color: var(--primary);">' + match.strand + '</strong><span style="font-size: 0.85rem; color: #666;">' + match.score + ' pts</span></div><div style="background: #f0f0f0; height: 18px; border-radius: 3px; overflow: hidden;"><div style="background: ' + color + '; height: 100%; width: ' + barPercent + '%; transition: width 0.5s ease; display: flex; align-items: center; justify-content: ' + justifyStyle + '; padding: 0 0.4rem;">' + pctDisplay + '</div></div><p style="font-size: 0.85rem; color: var(--text-light); margin: 0.3rem 0 0;">' + match.interpretation + '</p></div>';
                }).join('')}
            </div>
        </div>
        `;
    });

    html += '</div>';
    return html;
}

function renderScoreRanking(score_ranking) {
    if (!Array.isArray(score_ranking) || score_ranking.length === 0) {
        return '';
    }

    const maxScore = Math.max(...score_ranking.map(item => parseFloat(item.score) || 0));
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
    
    let html = '<div class="score-ranking" style="margin-top: 2rem;">';
    html += '<h4 style="margin-bottom: 1.5rem; color: var(--primary);">Your Strand Match Ranking</h4>';
    html += '<div style="background: white; padding: 1.5rem; border-radius: 0.5rem;">';

    score_ranking.forEach((item, idx) => {
        const percentage = parseFloat(item.percent) || 0;
        const barLength = (parseFloat(item.score) / maxScore) * 100;
        const color = colors[idx % colors.length];
        const medalSymbol = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
        
        html += `
        <div style="margin-bottom: 1.5rem; ${idx === score_ranking.length - 1 ? 'margin-bottom: 0;' : ''}">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex: 0.3;">
                    <span style="font-size: 1.3rem; min-width: 1.8rem; text-align: center;">${medalSymbol}</span>
                    <strong style="color: var(--text-dark);">${item.strand}</strong>
                </div>
                <span style="color: #666; font-size: 0.9rem; text-align: right;">${item.score} pts • ${percentage}%</span>
            </div>
            <div style="background: #f0f0f0; height: 24px; border-radius: 4px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(90deg, ${color}, ${adjustBrightness(color, 20)}); height: 100%; width: ${barLength}%; transition: width 0.5s ease; display: flex; align-items: center; justify-content: ${barLength > 40 ? 'flex-end' : 'flex-start'}; padding: 0 0.5rem;">
                    ${barLength > 30 ? `<span style="color: white; font-size: 0.8rem; font-weight: 600;">${Math.round(barLength)}%</span>` : ''}
                </div>
            </div>
        </div>
        `;
    });

    html += '</div></div>';
    return html;
}

function adjustBrightness(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function renderExplanationSummary(summary) {
    if (!summary) {
        return '';
    }

    const keyFactors = Array.isArray(summary.key_factors) ? summary.key_factors : [];
    let html = '<div class="explanation-summary" style="margin-top: 1.5rem; padding: 1rem; background: white; border-radius: 0.5rem; border-left: 4px solid var(--accent);">';
    html += '<h4 style="color: var(--accent); margin-bottom: 0.75rem;">AI Explanation Summary</h4>';
    html += `<p style="color: var(--text-light); margin-bottom: 0.75rem;">${summary.headline || 'This recommendation was generated by the AI model.'}</p>`;

    if (summary.confidence_note) {
        html += `<p style="font-size: 0.95rem; color: #666; margin-bottom: 0.75rem;">${summary.confidence_note}</p>`;
    }

    if (keyFactors.length > 0) {
        html += '<ul style="margin: 0; padding-left: 1.2rem; color: var(--text-light);">';
        keyFactors.forEach(factor => {
            html += `<li style="margin-bottom: 0.35rem;">${factor}</li>`;
        });
        html += '</ul>';
    }

    if (summary.primary_strand || summary.secondary_strand) {
        html += '<div style="margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">';
        if (summary.primary_strand) {
            html += `<span style="display: inline-block; padding: 0.35rem 0.65rem; background: #f3f6ff; border-radius: 999px; font-size: 0.9rem;"><strong>Top Strand:</strong> ${summary.primary_strand}</span>`;
        }
        if (summary.secondary_strand) {
            html += `<span style="display: inline-block; padding: 0.35rem 0.65rem; background: #f9f4ff; border-radius: 999px; font-size: 0.9rem;"><strong>Runner-up:</strong> ${summary.secondary_strand}</span>`;
        }
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function renderTvlSubtracks(tvl_subtracks) {
    if (!tvl_subtracks || Object.keys(tvl_subtracks).length === 0) {
        return '';
    }

    let html = '<div class="tvl-subtracks-detail" style="margin-top: 2rem;">';
    html += '<h4 style="margin-bottom: 1.5rem; color: var(--primary);">TVL Sub-Track Breakdown</h4>';

    const subtracks = ['ict', 'cookery', 'industrial'];
        const colors = ['#6366F1', '#F97316', '#DC2626'];
    
    subtracks.forEach(key => {
        if (tvl_subtracks[key]) {
            const track = tvl_subtracks[key];
            const colorIndex = ['ict', 'cookery', 'industrial'].indexOf(key);
            const color = colors[colorIndex];
            const percent = track.percent || 0;
            
            html += `
            <div style="background: white; padding: 1.2rem; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid ${color};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                    <h5 style="color: ${color}; margin: 0; font-size: 1rem;">${track.name}</h5>
                    <span style="font-weight: 700; color: ${color}; font-size: 1.1rem;">${percent}%</span>
                </div>
                <div style="background: #f0f0f0; height: 28px; border-radius: 4px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 0.8rem;">
                    <div style="background: linear-gradient(90deg, ${color}, ${adjustBrightness(color, 15)}); height: 100%; width: ${percent}%; transition: width 0.5s ease; display: flex; align-items: center; justify-content: ${percent > 40 ? 'flex-end' : 'flex-start'}; padding: 0 0.6rem;">
                        ${percent > 25 ? `<span style="color: white; font-size: 0.85rem; font-weight: 600;">${Math.round(percent)}%</span>` : ''}
                    </div>
                </div>
                <p style="color: var(--text-light); font-size: 0.9rem; margin: 0;">${track.careers}</p>
            </div>
            `;
        }
    });

    html += '</div>';
    return html;
}

function renderDecisionPath(decision_path, requires_counselor_review) {
    if (!Array.isArray(decision_path) || decision_path.length === 0) {
        return '';
    }

    let html = '<div class="decision-path" style="margin-top: 2rem;">';
    html += '<h4 style="margin-bottom: 1.5rem; color: var(--primary);">Decision Logic</h4>';

    const warningStyle = requires_counselor_review ? 'background: #fff3cd; border-left: 4px solid #ffc107; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;' : '';
    if (requires_counselor_review) {
        html += `<div style="${warningStyle}"><strong style="color: #856404;">⚠️ Counselor Review Recommended</strong><br><span style="font-size: 0.9rem; color: #856404;">Your profile shows mixed signals. Please discuss with a counselor.</span></div>`;
    }

    html += '<ol style="color: var(--text-light); margin-left: 1.5rem;">';
    decision_path.forEach(step => {
        html += `<li style="margin-bottom: 0.5rem;">${step}</li>`;
    });
    html += '</ol></div>';

    return html;
}

async function displayDetailedExplanation() {
    const explanation = await fetchDetailedExplanation();
    if (!explanation) {
        console.warn('No detailed explanation available');
        return;
    }

    const container = document.getElementById('explanationContainer') 
        || document.querySelector('#results-section .explanation-container')
        || document.createElement('div');

    if (!container.id) container.id = 'explanationContainer';

    let explainerHtml = '<div class="detailed-explanation" style="margin-top: 2rem; padding: 1.5rem; background: var(--bg-light); border-radius: 0.5rem;">';

    if (explanation.strength_assessment) {
        const strength = explanation.strength_assessment;
        const levelMap = {
            'Strong Match': { fill: '#10B981', percent: 90 },
            'Moderate Match': { fill: '#F59E0B', percent: 60 },
            'Weak Match': { fill: '#EF4444', percent: 40 },
            'Poor Match': { fill: '#DC2626', percent: 20 }
        };
        
        const level = strength.strength_level || 'Unknown';
        const config = levelMap[level] || levelMap['Moderate Match'];
        const circumference = 2 * Math.PI * 45;
        const offset = circumference - (config.percent / 100) * circumference;
        
        explainerHtml += `
        <div class="strength-box" style="background: white; padding: 1.2rem; border-radius: 0.5rem; margin-bottom: 1.5rem; border-left: 4px solid var(--primary);">
            <h4 style="color: var(--primary); margin-bottom: 0.8rem;">Assessment Strength</h4>
            <div style="display: flex; align-items: center; gap: 1.2rem;">
                <svg width="100" height="100" style="overflow: visible; flex-shrink: 0;">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" stroke-width="10"/>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="${config.fill}" stroke-width="10" 
                            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                            stroke-linecap="round" style="transform: rotate(-90deg); transform-origin: 50px 50px; transition: stroke-dashoffset 0.3s;"/>
                    <text x="50" y="57" text-anchor="middle" font-size="20" font-weight="bold" fill="${config.fill}">${config.percent}%</text>
                </svg>
                <div>
                    <p style="color: ${config.fill}; font-weight: 700; font-size: 1.1rem; margin: 0 0 0.3rem;">${strength.strength_level}</p>
                    <p style="color: var(--text-light); margin: 0 0 0.5rem; line-height: 1.4;">${strength.interpretation}</p>
                    <p style="font-size: 0.9rem; color: #666; margin: 0;">Score Range: ${strength.score_range}</p>
                </div>
            </div>
        </div>
        `;
    }

    explainerHtml += renderExplanationSummary(explanation.summary);

    explainerHtml += renderPartAnalysis(explanation.part_analysis);
    explainerHtml += renderScoreRanking(explanation.score_ranking);
    explainerHtml += renderTvlSubtracks(explanation.tvl_subtracks);
    explainerHtml += renderDecisionPath(explanation.decision_path, explanation.requires_counselor_review);

    if (explanation.final_decision_basis) {
        explainerHtml += `
        <div class="final-basis" style="margin-top: 1.5rem; padding: 1rem; background: white; border-radius: 0.5rem; border-left: 4px solid var(--accent);">
            <strong style="color: var(--accent);">Final Decision Basis</strong>
            <p style="color: var(--text-light); font-size: 0.95rem; margin-top: 0.5rem;">${explanation.final_decision_basis}</p>
        </div>
        `;
    }

    explainerHtml += '</div>';

    if (container.parentNode) {
        container.innerHTML = explainerHtml;
    } else {
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            container.innerHTML = explainerHtml;
            resultsSection.appendChild(container);
        }
    }
}

async function fetchAndDisplayResults() {
    try {
        const response = await apiRequest('/student/get_results.php', { method: 'GET' });
        console.log('Results response:', response);

        const results = response.data || response;

        if (!results.domain_scores || Object.keys(results.domain_scores).length === 0) {
            console.warn('No domain scores in results');
            setResultsVisibility(false);
            return;
        }

        latestResultsData = results;
        setResultsVisibility(true);

        // Build strand info mapping
        const strandInfo = {
            'STEM': {
                icon: '🔬',
                title: 'STEM',
                desc: 'Biology, Chemistry, Physics & Research',
                career: 'Excellent for careers in medicine, research, and scientific fields.'
            },
            'ABM': {
                icon: '🏢',
                title: 'ABM',
                desc: 'Business, Economics, & Management',
                career: 'Suitable for business leaders, entrepreneurs, and managers.'
            },
            'HUMSS': {
                icon: '🎨',
                title: 'HUMSS',
                desc: 'Humanities, Social Sciences, & Languages',
                career: 'Perfect for writers, educators, and social advocates.'
            },
            'TVL': {
                icon: '🛠️',
                title: 'TVL',
                desc: 'Technical & Practical Skills',
                career: 'Ideal for technicians, trades professionals, and applied specialists.'
            },
            'GAS': {
                icon: '📚',
                title: 'GAS',
                desc: 'Broad Foundation Knowledge',
                career: 'Provides well-rounded background for diverse paths.'
            },
            'Math': {
                icon: '🔬',
                title: 'Science Strand',
                desc: 'Biology, Chemistry, Physics & Research',
                career: 'Excellent for careers in medicine, research, and scientific fields.'
            },
            'Business': {
                icon: '🏢',
                title: 'Business Strand',
                desc: 'Business, Economics, & Management',
                career: 'Suitable for business leaders, entrepreneurs, and managers.'
            },
            'Language': {
                icon: '🎨',
                title: 'Arts & Humanities Strand',
                desc: 'Humanities, Social Sciences, & Languages',
                career: 'Perfect for writers, educators, and social advocates.'
            },
            'Practical': {
                icon: '🛠️',
                title: 'Technical/Vocational Strand',
                desc: 'Technical & Practical Skills',
                career: 'Ideal for technicians, trades professionals, and applied specialists.'
            },
            'General': {
                icon: '📚',
                title: 'General Studies',
                desc: 'Broad Foundation Knowledge',
                career: 'Provides well-rounded background for diverse paths.'
            }
        };

        // Find dynamic results containers
        const academicResultsContainer = document.getElementById('academicResultsContainer')
            || document.querySelector('#results-section .track-section .results-container');
        const tvlResultsContainer = document.getElementById('tvlResultsContainer');
        const tvlTrackSection = document.getElementById('tvlTrackSection');

        if (!academicResultsContainer) {
            console.warn('Results container not found');
            return;
        }

        // Clear existing cards
        academicResultsContainer.classList.add('dynamic-results');
        academicResultsContainer.innerHTML = '';

        // Sort domains by score (highest first)
        const sortedDomains = Object.entries(results.domain_scores)
            .sort((a, b) => b[1] - a[1]);

        // Calculate max score for percentage
        const maxScore = Math.max(...Object.values(results.domain_scores), 1);
        const maxWeightedScore = Number(results.max_weighted_score || 54);
        const chartColors = ['#F4DF4E', '#10C57A', '#F35678', '#57B3FF', '#9D8BFF', '#F59E0B'];

        const topDecisionBasis = escapeHtml(results?.top_recommendation?.decision_basis || '');
        const topConfidence = escapeHtml(results?.top_recommendation?.confidence || '');
        const topStrength = escapeHtml(results?.top_recommendation?.strength_level || '');
        const recommendationSummary = results?.recommendation_summary || null;
        const strengthAssessment = results?.strength_assessment || null;
        const originalTopDomain = sortedDomains[0]?.[0] || null;

        const buildResultCard = (entry, isTop = false) => {
            const { domain, info, percentage, chartColor } = entry;
            return `
                <article class="result-card interactive-card ${isTop ? 'is-top-match is-selected' : 'is-compact'}" data-domain="${escapeHtml(domain)}" role="button" tabindex="0" aria-expanded="${isTop ? 'true' : 'false'}">
                    <div class="result-summary">
                        <div class="radial-progress" style="--radial-accent:${chartColor}; --radial-pct:${percentage};" aria-hidden="true">
                            <svg class="radial-svg" viewBox="0 0 120 120" focusable="false" aria-hidden="true">
                                <circle class="radial-track" cx="60" cy="60" r="46"></circle>
                                <circle class="radial-value" cx="60" cy="60" r="46"></circle>
                            </svg>
                            <div class="radial-center">${percentage}%</div>
                        </div>
                        <div class="strand-meta">
                            <h3>${info.icon} ${escapeHtml(info.title)}</h3>
                            <p class="strand-subtitle">${escapeHtml(info.desc)}</p>
                        </div>
                    </div>
                </article>
            `;
        };

        const domainEntries = sortedDomains.map(([domain, score], index) => {
            const info = strandInfo[domain] || {
                icon: '📖',
                title: domain,
                desc: 'Academic Strand',
                career: 'Explore this strand for more information.'
            };

            const percentage = Math.round((score / Math.max(maxWeightedScore, maxScore)) * 100);
            const chartColor = chartColors[index % chartColors.length];
            const explanationText = domain === originalTopDomain && topDecisionBasis
                ? topDecisionBasis
                : `${escapeHtml(info.career)} Score: ${percentage}% match based on your submitted responses.`;
            return {
                domain,
                info,
                percentage,
                chartColor,
                explanationText
            };
        });

        let activeDomain = domainEntries[0]?.domain || null;

        academicResultsContainer.innerHTML = `
            <div class="radial-results-dashboard">
                <div class="radial-top-match-wrap"></div>
                <div class="radial-other-strands"></div>
            </div>
        `;

        const topMatchWrap = academicResultsContainer.querySelector('.radial-top-match-wrap');
        const otherStrandsWrap = academicResultsContainer.querySelector('.radial-other-strands');

        const generateStrengthMeterChart = (strengthAssessment) => {
            if (!strengthAssessment) return '';
            
            const level = strengthAssessment.strength_level || 'Unknown';
            const levelMap = {
                'Strong Match': { fill: '#10B981', percent: 90 },
                'Moderate Match': { fill: '#F59E0B', percent: 60 },
                'Weak Match': { fill: '#EF4444', percent: 40 },
                'Poor Match': { fill: '#DC2626', percent: 20 }
            };
            
            const config = levelMap[level] || levelMap['Moderate Match'];
            const circumference = 2 * Math.PI * 45;
            const offset = circumference - (config.percent / 100) * circumference;
            
            return `
            <div style="margin-top: 0.85rem; padding: 0.85rem 0.95rem; background: var(--bg-light); border-left: 4px solid var(--primary); border-radius: 0.45rem;">
                <p style="margin: 0 0 0.5rem; font-weight: 700; color: var(--primary-dark);">Assessment Strength</p>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <svg width="80" height="80" style="overflow: visible;">
                        <circle cx="40" cy="40" r="35" fill="none" stroke="#e5e7eb" stroke-width="8"/>
                        <circle cx="40" cy="40" r="35" fill="none" stroke="${config.fill}" stroke-width="8" 
                                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                                stroke-linecap="round" style="transform: rotate(-90deg); transform-origin: 40px 40px; transition: stroke-dashoffset 0.3s;"/>
                        <text x="40" y="45" text-anchor="middle" font-size="16" font-weight="bold" fill="${config.fill}">${config.percent}%</text>
                    </svg>
                    <div>
                        <p style="margin: 0 0 0.25rem; font-weight: 700; color: ${config.fill};">${escapeHtml(level)}</p>
                        <p style="margin: 0 0 0.3rem; color: var(--text-light); font-size: 0.9rem;">${escapeHtml(strengthAssessment.interpretation || '')}</p>
                        <p style="margin: 0; color: #666; font-size: 0.85rem;">Range: ${escapeHtml(strengthAssessment.score_range || '')}</p>
                    </div>
                </div>
            </div>
            `;
        };

        const renderAcademicDashboard = () => {
            if (!topMatchWrap || !otherStrandsWrap || !activeDomain) {
                return;
            }

            const activeEntry = domainEntries.find(item => item.domain === activeDomain) || domainEntries[0];
            if (!activeEntry) {
                return;
            }

            const remainingEntries = domainEntries.filter(item => item.domain !== activeEntry.domain);
            topMatchWrap.innerHTML = `
                ${buildResultCard(activeEntry, true)}
                <aside class="fixed-explanation-panel" aria-live="polite">
                    <span class="explanation-label">Why this strand fits</span>
                    <h4>${escapeHtml(activeEntry.info.title)} Recommendation Insight</h4>
                    <p>${activeEntry.explanationText}</p>
                    ${strengthAssessment ? generateStrengthMeterChart(strengthAssessment) : ''}
                    ${recommendationSummary ? `
                    <div style="margin-top: 0.9rem; padding-top: 0.9rem; border-top: 1px solid rgba(0,0,0,0.06);">
                        <p style="font-weight: 700; color: var(--primary-dark); margin-bottom: 0.6rem;">3 Reasons</p>
                        <ol style="margin: 0 0 0.9rem; padding-left: 1.15rem; color: var(--text-light);">
                            ${(recommendationSummary.reasons || []).slice(0, 3).map(reason => `<li style="margin-bottom: 0.35rem;">${escapeHtml(reason)}</li>`).join('')}
                        </ol>
                        <p style="font-weight: 700; color: var(--primary-dark); margin-bottom: 0.6rem;">2 Suggestions</p>
                        <ol style="margin: 0; padding-left: 1.15rem; color: var(--text-light);">
                            ${(recommendationSummary.suggestions || []).slice(0, 2).map(suggestion => `<li style="margin-bottom: 0.35rem;">${escapeHtml(suggestion)}</li>`).join('')}
                        </ol>
                        ${topConfidence ? `<p style="margin: 0.9rem 0 0; font-size: 0.9rem; color: #666;">Confidence: <strong>${topConfidence}</strong>${topStrength ? ` · Match level: <strong>${topStrength}</strong>` : ''}</p>` : ''}
                    </div>
                    ` : ''}
                </aside>
            `;

            otherStrandsWrap.innerHTML = remainingEntries.map(entry => buildResultCard(entry, false)).join('');

            const compactCards = otherStrandsWrap.querySelectorAll('.interactive-card.is-compact');
            compactCards.forEach((card) => {
                const onSelect = () => {
                    const selectedDomain = card.getAttribute('data-domain');
                    if (!selectedDomain || selectedDomain === activeDomain) {
                        return;
                    }
                    activeDomain = selectedDomain;
                    renderAcademicDashboard();
                };

                card.addEventListener('click', onSelect);
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect();
                    }
                });
            });
        };

        renderAcademicDashboard();

        // Render TVL sub-track scores from real backend explanation payload.
        const tvlSubtracks = results.tvl_subtracks || {};
        const tvlAcademicEntry = domainEntries.find(item => item.domain === 'TVL');
        const tvlAcademicPercent = Number(tvlAcademicEntry?.percentage || 0);
        if (tvlTrackSection && tvlResultsContainer) {
            const entries = [
                {
                    key: 'ICT',
                    icon: '💻',
                    title: 'ICT Strand',
                    desc: 'Information & Communications Technology',
                    career: 'Excellent for IT professionals, software developers, and tech support specialists.'
                },
                {
                    key: 'Cookery',
                    icon: '🍳',
                    title: 'Cookery Strand',
                    desc: 'Culinary Arts & Food Service',
                    career: 'Perfect for aspiring chefs, food entrepreneurs, and hospitality professionals.'
                },
                {
                    key: 'Industrial',
                    icon: '🧰',
                    title: 'Industrial Arts Strand',
                    desc: 'Electronics, automotive, and skilled trades',
                    career: 'Great for technicians, electricians, mechanics, and applied craft careers.'
                }
            ];

            const available = entries
                .map(meta => {
                    const data = tvlSubtracks[meta.key];
                    const inTvlPercent = Number(data?.percent || 0);
                    const overallPercent = Math.round((tvlAcademicPercent * inTvlPercent) / 100);
                    return {
                        meta,
                        data,
                        inTvlPercent,
                        overallPercent
                    };
                })
                .filter(item => item.data);

            if (available.length > 0) {
                tvlTrackSection.style.display = '';
                tvlResultsContainer.innerHTML = '';

                available.forEach((item, idx) => {
                    const pct = item.overallPercent;
                    const chartColor = chartColors[(idx + 1) % chartColors.length];
                    const card = `
                        <div class="result-card tvl-circle-card">
                            <div class="result-summary">
                                <div class="radial-progress" style="--radial-accent:${chartColor}; --radial-pct:${pct};" aria-hidden="true">
                                    <svg class="radial-svg" viewBox="0 0 120 120" focusable="false" aria-hidden="true">
                                        <circle class="radial-track" cx="60" cy="60" r="46"></circle>
                                        <circle class="radial-value" cx="60" cy="60" r="46"></circle>
                                    </svg>
                                    <div class="radial-center">${pct}%</div>
                                </div>
                                <h3>${item.meta.icon} ${item.meta.title}</h3>
                                <p style="color: var(--text-light); margin: 0.6rem 0 0;">${item.meta.desc}</p>
                            </div>
                            <p class="tvl-caption">${pct}% overall (from ${item.inTvlPercent}% of TVL)</p>
                            <p class="tvl-career">${item.meta.career}</p>
                        </div>
                    `;
                    tvlResultsContainer.insertAdjacentHTML('beforeend', card);
                });
            } else {
                tvlTrackSection.style.display = 'none';
            }
        }

        if (Array.isArray(results.decision_path) && results.decision_path.length > 0) {
            console.log('Tie decision path:', results.decision_path.join(' | '));
        }

        applyResultsSummaryToDashboard(results);
        const stored = getStoredProgress();
        updateProgressUI({ hasResults: true, explored: stored.explored });

        // Load and display detailed explanation
        setTimeout(() => {
            displayDetailedExplanation().catch(err => {
                console.warn('Failed to load detailed explanation:', err);
            });
        }, 500);
    } catch (err) {
        console.error('Failed to fetch results:', err);
        console.error('Error details:', err.message);
        await uiAlert(`Failed to load your results: ${err.message}`, 'Request Failed');
    }
}

async function submitAssessment() {
    if (!(await checkAuth())) {
        return;
    }

    const payload = collectAssessmentPayload();

    if (payload.error) {
        await uiAlert(payload.error, 'Incomplete Assessment');
        return;
    }

    try {
        console.log('Submitting payload:', payload);
        await apiRequest('/student/submit_survey.php', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        uiToast('Assessment submitted successfully! Fetching your personalized recommendations...', 'success');
        
        // Fetch and display results
        await fetchAndDisplayResults();
        
        // Navigate to results section
        document.querySelector('[data-section="results"]')?.click();
    } catch (err) {
        console.error('Submit error:', err);
        if ((err.message || '').toLowerCase().includes('unauthorized')) {
            clearSessionStorage();
            window.location.href = 'login.html';
            return;
        }
        await uiAlert(`Failed to submit assessment: ${err.message}`, 'Submit Failed');
    }
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        section.classList.add('active');
    }

    document.querySelector(`[data-section="${sectionId.replace('-section', '')}"]`)?.click();
}

window.addEventListener('resize', function () {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth > 768 && sidebar) {
        sidebar.classList.remove('collapsed');
    }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && document.querySelector(href)) {
            e.preventDefault();
            document.querySelector(href).scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

window.addEventListener('DOMContentLoaded', async function () {
    initAssessmentWizard();
    initExploreCarousels();
    await navigateToDashboard();
});
