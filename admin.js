/* ============ ADMIN DASHBOARD JAVASCRIPT ============ */

const API_BASE = 'api';
let adminUser = null;

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
    localStorage.setItem('userType', (user.role || 'admin').toLowerCase());
    localStorage.setItem('userEmail', user.email || '');
    localStorage.setItem('userName', fullName || user.email || 'Administrator');
}

function clearSessionStorage() {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userType');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('adminToken');
}

async function verifyAdminSession() {
    try {
        const me = await apiRequest('/auth/me.php', { method: 'GET' });
        adminUser = me.data;

        if ((adminUser.role || '').toLowerCase() !== 'admin') {
            window.location.href = 'main.html';
            return false;
        }

        persistSession(adminUser);
        const adminName = document.querySelector('.admin-name');
        const adminAvatar = document.querySelector('.admin-avatar');
        if (adminName) {
            adminName.textContent = `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || 'Administrator';
        }
        if (adminAvatar) {
            const initials = `${adminUser.first_name?.charAt(0) || ''}${adminUser.last_name?.charAt(0) || ''}`.toUpperCase() || 'AD';
            adminAvatar.textContent = initials;
        }

        return true;
    } catch (err) {
        clearSessionStorage();
        window.location.href = 'login.html';
        return false;
    }
}

// Initialize admin dashboard
window.addEventListener('DOMContentLoaded', async function () {
    if (!(await verifyAdminSession())) {
        return;
    }

    initializeSidebar();
    initializeModals();
    initializeTables();
    initializeCharts();
    loadDashboardData();
});

// ============ SIDEBAR NAVIGATION ============

function initializeSidebar() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section') + '-section';

            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            this.classList.add('active');
            document.getElementById(sectionId)?.classList.add('active');
        });
    });

    document.querySelector('[data-section="dashboard"]')?.classList.add('active');
}

// ============ MODALS ============

function initializeModals() {
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeModal.call(this.querySelector('.close-btn'));
            }
        });
    });

    // Set up form handlers
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUserSubmit);
    }

    const addAssessmentForm = document.getElementById('addAssessmentForm');
    if (addAssessmentForm) {
        addAssessmentForm.addEventListener('submit', handleAddAssessmentSubmit);
    }
}

function openAddUserModal() {
    document.getElementById('addUserModal')?.classList.add('show');
}

function openAddAssessmentModal() {
    document.getElementById('addAssessmentModal')?.classList.add('show');
}

function closeModal() {
    const modal = this?.closest('.modal');
    if (modal) {
        modal.classList.remove('show');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

async function handleAddUserSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData);

    // Validate password minimum length
    if (payload.password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
    }

    try {
        const response = await apiRequest('/admin/users.php', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        alert('User created successfully!');
        closeModal.call(form.closest('.modal').querySelector('.close-btn'));
        loadUsersTable(); // Refresh the users table
    } catch (err) {
        alert(`Failed to create user: ${err.message}`);
    }
}

async function handleAddAssessmentSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData);
    payload.total_questions = parseInt(payload.total_questions);

    // Validate inputs
    if (payload.name.length < 3) {
        alert('Assessment name must be at least 3 characters');
        return;
    }

    if (payload.description.length < 10) {
        alert('Assessment description must be at least 10 characters');
        return;
    }

    if (payload.total_questions < 1 || payload.total_questions > 100) {
        alert('Total questions must be between 1 and 100');
        return;
    }

    try {
        const response = await apiRequest('/admin/assessments.php', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        alert('Assessment created successfully!');
        closeModal.call(form.closest('.modal').querySelector('.close-btn'));
        loadAssessmentsTable(); // Refresh assessments table
    } catch (err) {
        alert(`Failed to create assessment: ${err.message}`);
    }
}

// ============ DASHBOARD ============

async function loadDashboardData() {
    try {
        const response = await apiRequest('/admin/stats.php', { method: 'GET' });
        updateStats(response.data || {});
    } catch (err) {
        alert(`Failed to load dashboard stats: ${err.message}`);
    }

    renderCharts();
    loadActivityFeed();
}

function updateStats(stats = {}) {
    const totalUsers = document.getElementById('totalUsers');
    const completedAssessments = document.getElementById('completedAssessments');
    const avgScore = document.getElementById('avgScore');
    const activeSessions = document.getElementById('activeSessions');

    if (totalUsers) totalUsers.textContent = String(stats.total_users ?? 0);
    if (completedAssessments) completedAssessments.textContent = String(stats.total_survey_responses ?? 0);
    if (avgScore) avgScore.textContent = 'N/A';
    if (activeSessions) activeSessions.textContent = String(stats.total_students ?? 0);
}

function renderCharts() {
    renderStrandChart();
    renderUserGrowthChart();
}

function renderStrandChart() {
    const chart = document.querySelector('.strand-chart');
    if (!chart) return;

    // Placeholder visualization until recommendation aggregation endpoint is added.
    const data = [
        { name: 'Science', percent: 25 },
        { name: 'Technology', percent: 25 },
        { name: 'Business', percent: 25 },
        { name: 'Arts', percent: 25 }
    ];

    chart.innerHTML = data.map(item => `
        <div class="strand-bar">
            <div class="strand-label">${item.name}</div>
            <div class="strand-progress">
                <div class="strand-fill ${item.name.toLowerCase()}" style="width: ${item.percent}%"></div>
            </div>
            <div class="strand-percent">${item.percent}%</div>
        </div>
    `).join('');
}

function renderUserGrowthChart() {
    const userChart = document.getElementById('userGrowthChart');
    if (!userChart) return;

    const data = [35, 41, 37, 49, 55, 44, 60];
    const maxValue = Math.max(...data);
    userChart.innerHTML = data.map(value => `
        <div class="day-bar" style="height: ${(value / maxValue) * 100}%; min-height: 30px;"></div>
    `).join('');
}

function loadActivityFeed() {
    const activityList = document.getElementById('activityFeed');
    if (!activityList) return;

    const activities = [
        { time: 'Now', desc: 'Admin dashboard loaded from backend session.' },
        { time: 'Today', desc: 'Student survey data source switched to API.' },
        { time: 'Today', desc: 'Auth flow now uses PHP endpoints.' }
    ];

    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div>
                <div class="activity-time">${activity.time}</div>
                <div class="activity-desc">${activity.desc}</div>
            </div>
            <span>→</span>
        </div>
    `).join('');
}

// ============ USERS MANAGEMENT ============

function initializeTables() {
    loadUsersTable();
    loadAssessmentsTable();
    initializeSearch();
    initializeFilter();
}

async function loadUsersTable(search = '') {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    try {
        const params = new URLSearchParams();
        if (search.trim() !== '') {
            params.set('search', search.trim());
        }
        params.set('limit', '100');

        const response = await apiRequest(`/admin/students.php?${params.toString()}`, { method: 'GET' });
        const users = response.data || [];

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.first_name} ${user.last_name}</td>
                <td>${user.email}</td>
                <td>${user.school_name || '-'}</td>
                <td>${user.grade_level || '-'}</td>
                <td><span class="badge ${user.status === 'active' ? 'active' : 'warning'}">${user.status}</span></td>
                <td>-</td>
                <td>
                    <button class="btn-small btn-info" onclick="viewUserDetails(${user.student_id})">View</button>
                    <button class="btn-small btn-danger" onclick="deleteUser(${user.student_id})">Delete</button>
                </td>
            </tr>
        `).join('');

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No users found.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7">Failed to load users: ${err.message}</td></tr>`;
    }
}

function loadAssessmentsTable() {
    const tbody = document.getElementById('assessmentsTableBody');
    if (!tbody) return;

    // This section remains sample data until an assessments admin endpoint is added.
    const assessments = [
        { id: 1, questionId: 'Q001', category: 'Interest', question: 'Which subject do you find most enjoyable?', responses: 0, status: 'Active' },
        { id: 2, questionId: 'Q002', category: 'Career', question: 'Which career path interests you the most?', responses: 0, status: 'Active' }
    ];

    tbody.innerHTML = assessments.map(item => `
        <tr>
            <td>${item.questionId}</td>
            <td>${item.category}</td>
            <td>${item.question}</td>
            <td>${item.responses}</td>
            <td><span class="badge success">${item.status}</span></td>
            <td>
                <button class="btn-small btn-info" onclick="editAssessment(${item.id})">Edit</button>
                <button class="btn-small btn-danger" onclick="deleteAssessment(${item.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function initializeSearch() {
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            loadUsersTable(this.value);
        });
    }
}

function initializeFilter() {
    const filterSelect = document.getElementById('assessmentFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function () {
            filterAssessments(this.value);
        });
    }
}

function searchUsers() {
    const query = document.getElementById('userSearch')?.value || '';
    loadUsersTable(query);
}

function filterAssessments(value) {
    const rows = document.querySelectorAll('#assessmentsTableBody tr');
    rows.forEach(row => {
        if (!value || value === 'all') {
            row.style.display = '';
            return;
        }

        const statusCell = row.querySelector('td:nth-child(5)');
        const status = (statusCell?.textContent || '').toLowerCase();
        row.style.display = status.includes(value.toLowerCase()) ? '' : 'none';
    });
}

function viewUserDetails(userId) {
    alert(`Viewing details for student ${userId}`);
}

function deleteUser(userId) {
    alert(`Delete action for student ${userId} will be wired after delete endpoint is added.`);
}

function viewAssessment(assessmentId) {
    alert(`Viewing assessment ${assessmentId}`);
}

function editAssessment(assessmentId) {
    alert(`Edit assessment ${assessmentId} is not yet connected.`);
}

function deleteAssessment(assessmentId) {
    alert(`Delete assessment ${assessmentId} is not yet connected.`);
}

// ============ ANALYTICS ============

function loadAnalyticsData() {
    const analyticsGrid = document.querySelector('.analytics-grid');
    if (!analyticsGrid) {
        return;
    }

    analyticsGrid.querySelectorAll('.stat').forEach(el => {
        if (el.textContent.includes('%')) {
            el.textContent = 'Live soon';
        }
    });
}

// ============ REPORTS ============

function loadReportsData() {
    const reportsGrid = document.querySelector('.reports-grid');
    if (!reportsGrid) {
        return;
    }
}

function generateReport(reportName) {
    alert(`Generating ${reportName}...`);
}

function downloadReport(reportName) {
    alert(`Downloading ${reportName}...`);
}

// ============ SETTINGS ============

function initializeSettings() {
    const settingsForms = document.querySelectorAll('.settings-group form');
    settingsForms.forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            saveSettings();
        });
    });
}

function saveSettings() {
    alert('Settings saved successfully!');
}

function backupDatabase() {
    if (confirm('This will create a backup of the database. Continue?')) {
        alert('Database backup started.');
    }
}

function clearCache() {
    if (confirm('This will clear all cached data. Continue?')) {
        location.reload();
    }
}

function resetSystem() {
    if (confirm('Are you sure you want to reset the system? This cannot be undone!')) {
        alert('Reset flow not connected yet.');
    }
}

// ============ ADMIN LOGOUT ============

async function logoutAdmin() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    try {
        await apiRequest('/auth/logout.php', { method: 'POST', body: JSON.stringify({}) });
    } catch (err) {
        // Continue local logout flow.
    }

    clearSessionStorage();
    window.location.href = 'login.html';
}

// ============ AUTO-LOAD SECTIONS ============

document.addEventListener('DOMContentLoaded', function () {
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'class') {
                const { target } = mutation;
                if (target.classList.contains('active')) {
                    const sectionId = target.id;

                    if (sectionId === 'dashboard-section') {
                        loadDashboardData();
                    } else if (sectionId === 'analytics-section') {
                        loadAnalyticsData();
                    } else if (sectionId === 'reports-section') {
                        loadReportsData();
                    } else if (sectionId === 'settings-section') {
                        initializeSettings();
                    }
                }
            }
        });
    });

    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        observer.observe(section, { attributes: true, attributeFilter: ['class'] });
    });

    setTimeout(() => {
        loadAnalyticsData();
        loadReportsData();
    }, 500);
});
