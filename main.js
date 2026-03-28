const API_BASE = 'api';
let currentUser = null;
let latestResultsData = null;

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

    const data = await response.json().catch(() => ({ success: false, message: 'Invalid server response' }));
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
}

function clearSessionStorage() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userSchool');
    localStorage.removeItem('userGrade');
    localStorage.removeItem('userType');
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

        if (hasResults) {
            applyResultsSummaryToDashboard(results);
        }

        updateProgressUI({ hasResults, explored: stored.explored });
    } catch (_err) {
        const stored = getStoredProgress();
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
    window.location.href = 'login.html';
}

function scrollToTop() {
    window.scrollTo(0, 0);
}

function loadUserData() {
    const userName = currentUser
        ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
        : (localStorage.getItem('userName') || 'User');
    const userEmail = currentUser?.email || localStorage.getItem('userEmail') || 'user@example.com';
    const userSchool = currentUser?.school_name || localStorage.getItem('userSchool') || 'Example School';
    const userGrade = currentUser?.grade_level || localStorage.getItem('userGrade') || 'Grade 10';

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

    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Hello, ${userName}! Welcome to your personal strand recommendation dashboard. This is your space to discover which academic strand aligns best with your interests, strengths, and career goals.`;
    }

    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileSchool = document.getElementById('profileSchool');
    const profileGrade = document.getElementById('profileGrade');

    if (profileName) profileName.textContent = userName;
    if (profileEmail) profileEmail.textContent = userEmail;
    if (profileSchool) profileSchool.textContent = userSchool;
    if (profileGrade) profileGrade.textContent = userGrade;
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

async function fetchAndDisplayResults() {
    try {
        const response = await apiRequest('/student/get_results.php', { method: 'GET' });
        console.log('Results response:', response);

        const results = response.data || response;

        if (!results.domain_scores || Object.keys(results.domain_scores).length === 0) {
            console.warn('No domain scores in results');
            return;
        }

        latestResultsData = results;

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
        academicResultsContainer.innerHTML = '';

        // Sort domains by score (highest first)
        const sortedDomains = Object.entries(results.domain_scores)
            .sort((a, b) => b[1] - a[1]);

        // Calculate max score for percentage
        const maxScore = Math.max(...Object.values(results.domain_scores), 1);
        const maxWeightedScore = Number(results.max_weighted_score || 54);

        // Create result cards for each domain
        sortedDomains.forEach(([domain, score]) => {
            const info = strandInfo[domain] || {
                icon: '📖',
                title: domain,
                desc: 'Academic Strand',
                career: 'Explore this strand for more information.'
            };

            const percentage = Math.round((score / Math.max(maxWeightedScore, maxScore)) * 100);
            const html = `
                <div class="result-card">
                    <h3>${info.icon} ${info.title}</h3>
                    <p style="color: var(--text-light); margin-bottom: 1rem;">${info.desc}</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%;"></div>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-light); margin: 1rem 0;">${percentage}% Match</p>
                    <p style="color: var(--text-light); font-size: 0.95rem;">${info.career}</p>
                </div>
            `;
            academicResultsContainer.insertAdjacentHTML('beforeend', html);
        });

        // Render TVL sub-track scores from real backend explanation payload.
        const tvlSubtracks = results.tvl_subtracks || {};
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
                .map(meta => ({ meta, data: tvlSubtracks[meta.key] }))
                .filter(item => item.data && Number(item.data.percent) > 0);

            if (available.length > 0) {
                tvlTrackSection.style.display = '';
                tvlResultsContainer.innerHTML = '';

                available.forEach(item => {
                    const pct = Math.round(Number(item.data.percent) || 0);
                    const card = `
                        <div class="result-card">
                            <h3>${item.meta.icon} ${item.meta.title}</h3>
                            <p style="color: var(--text-light); margin-bottom: 1rem;">${item.meta.desc}</p>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${pct}%;"></div>
                            </div>
                            <p style="font-size: 0.9rem; color: var(--text-light); margin: 1rem 0;">${pct}% TVL Sub-track Match</p>
                            <p style="color: var(--text-light); font-size: 0.95rem;">${item.meta.career}</p>
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
    await navigateToDashboard();
});
