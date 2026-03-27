const API_BASE = 'api';
let currentUser = null;

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

        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('collapsed');
            }
        }
    });
});

function mapQuestionToCategory(questionNumber) {
    if (questionNumber <= 10) return 'Interest';
    if (questionNumber <= 20) return 'Career';
    if (questionNumber <= 30) return 'Skill';
    return 'Financial';
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

        // Build strand info mapping
        const strandInfo = {
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

        // Find the results container
        const resultsContainer = document.querySelector('#results-section .results-container');
        if (!resultsContainer) {
            console.warn('Results container not found');
            return;
        }

        // Clear existing cards
        resultsContainer.innerHTML = '';

        // Sort domains by score (highest first)
        const sortedDomains = Object.entries(results.domain_scores)
            .sort((a, b) => b[1] - a[1]);

        // Calculate max score for percentage
        const maxScore = Math.max(...Object.values(results.domain_scores), 1);

        // Create result cards for each domain
        sortedDomains.forEach(([domain, score]) => {
            const info = strandInfo[domain] || {
                icon: '📖',
                title: domain,
                desc: 'Academic Strand',
                career: 'Explore this strand for more information.'
            };

            const percentage = Math.round((score / (20 * 1)) * 100);
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
            resultsContainer.insertAdjacentHTML('beforeend', html);
        });

        // Update dashboard stats
        if (results.top_recommendation) {
            const topMatchCard = document.querySelector('.dashboard-grid .dashboard-item:nth-child(2)');
            if (topMatchCard) {
                const valueElement = topMatchCard.querySelector('.card-value');
                if (valueElement) {
                    valueElement.textContent = results.top_recommendation.strand;
                }
            }
        }

        // Mark assessment as completed
        const statusCard = document.querySelector('.dashboard-grid .dashboard-item:nth-child(1)');
        if (statusCard) {
            const valueElement = statusCard.querySelector('.card-value');
            if (valueElement) {
                valueElement.textContent = 'Completed ✓';
                valueElement.style.color = '#4caf50';
            }
        }
    } catch (err) {
        console.error('Failed to fetch results:', err);
        console.error('Error details:', err.message);
        alert(`Failed to load your results: ${err.message}`);
    }
}

async function submitAssessment() {
    if (!(await checkAuth())) {
        return;
    }

    const payload = collectAssessmentPayload();

    if (payload.error) {
        alert(payload.error);
        return;
    }

    try {
        console.log('Submitting payload:', payload);
        await apiRequest('/student/submit_survey.php', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        alert('Assessment submitted successfully! Fetching your personalized recommendations...');
        
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
        alert(`Failed to submit assessment: ${err.message}`);
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
