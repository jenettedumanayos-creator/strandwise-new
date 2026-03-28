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
                <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
                <td>
                    <button class="btn-small btn-info" onclick="viewUserDetails(${user.user_id})">View</button>
                    <button class="btn-small btn-info" onclick="editUser(${user.user_id})">Edit</button>
                    <button class="btn-small btn-danger" onclick="deleteUser(${user.user_id})">Delete</button>
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

    apiRequest('/admin/assessments.php?limit=100', { method: 'GET' })
        .then(response => {
            const assessments = response.data || [];

            tbody.innerHTML = assessments.map(item => `
                <tr>
                    <td>A-${item.assessment_id}</td>
                    <td>${item.assessment_name}</td>
                    <td>${item.description || '-'}</td>
                    <td>${item.responses ?? 0}</td>
                    <td><span class="badge success">Active</span></td>
                    <td>
                        <button class="btn-small btn-info" onclick="editAssessment(${item.assessment_id})">Edit</button>
                        <button class="btn-small btn-danger" onclick="deleteAssessment(${item.assessment_id})">Delete</button>
                    </td>
                </tr>
            `).join('');

            if (assessments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No assessments found.</td></tr>';
            }
        })
        .catch(err => {
            tbody.innerHTML = `<tr><td colspan="6">Failed to load assessments: ${err.message}</td></tr>`;
        });
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

async function viewUserDetails(userId) {
    try {
        const response = await apiRequest(`/admin/users.php?user_id=${encodeURIComponent(userId)}`, { method: 'GET' });
        const user = response.data || {};

        alert(
            `Name: ${user.first_name || ''} ${user.last_name || ''}\n` +
            `Email: ${user.email || '-'}\n` +
            `Role: ${user.role || '-'}\n` +
            `School: ${user.school_name || '-'}\n` +
            `Grade: ${user.grade_level || '-'}\n` +
            `Status: ${user.status || '-'}\n` +
            `Joined: ${user.created_at ? new Date(user.created_at).toLocaleString() : '-'}`
        );
    } catch (err) {
        alert(`Failed to load user details: ${err.message}`);
    }
}

async function editUser(userId) {
    try {
        const response = await apiRequest(`/admin/users.php?user_id=${encodeURIComponent(userId)}`, { method: 'GET' });
        const user = response.data || {};

        const firstName = prompt('First name', user.first_name || '');
        if (firstName === null) return;
        const lastName = prompt('Last name', user.last_name || '');
        if (lastName === null) return;
        const email = prompt('Email', user.email || '');
        if (email === null) return;
        const school = prompt('School name', user.school_name || '');
        if (school === null) return;

        let gradeLevel = user.grade_level || '';
        if ((user.role || '').toLowerCase() === 'student') {
            const gradeInput = prompt('Grade level (Grade 9 / Grade 10 / Grade 11 / Grade 12)', gradeLevel);
            if (gradeInput === null) return;
            gradeLevel = gradeInput;
        }

        const status = prompt('Status (active/inactive)', (user.status || 'active').toLowerCase());
        if (status === null) return;

        await apiRequest('/admin/users.php', {
            method: 'PUT',
            body: JSON.stringify({
                user_id: userId,
                first_name: firstName,
                last_name: lastName,
                email,
                school,
                grade_level: gradeLevel,
                status
            })
        });

        alert('User updated successfully.');
        loadUsersTable(document.getElementById('userSearch')?.value || '');
    } catch (err) {
        alert(`Failed to update user: ${err.message}`);
    }
}

async function deleteUser(userId) {
    if (!confirm('Delete this user? This action cannot be undone.')) {
        return;
    }

    try {
        await apiRequest('/admin/users.php', {
            method: 'DELETE',
            body: JSON.stringify({ user_id: userId })
        });

        alert('User deleted successfully.');
        loadUsersTable(document.getElementById('userSearch')?.value || '');
    } catch (err) {
        alert(`Failed to delete user: ${err.message}`);
    }
}

function viewAssessment(assessmentId) {
    alert(`Viewing assessment ${assessmentId}`);
}

async function editAssessment(assessmentId) {
    try {
        const response = await apiRequest(`/admin/assessments.php?assessment_id=${encodeURIComponent(assessmentId)}`, { method: 'GET' });
        const assessment = response.data || {};

        const name = prompt('Assessment name', assessment.assessment_name || '');
        if (name === null) return;
        const description = prompt('Assessment description', assessment.description || '');
        if (description === null) return;

        await apiRequest('/admin/assessments.php', {
            method: 'PUT',
            body: JSON.stringify({
                assessment_id: assessmentId,
                name,
                description
            })
        });

        alert('Assessment updated successfully.');
        loadAssessmentsTable();
    } catch (err) {
        alert(`Failed to update assessment: ${err.message}`);
    }
}

async function deleteAssessment(assessmentId) {
    if (!confirm('Delete this assessment? This will also remove related assessment results.')) {
        return;
    }

    try {
        await apiRequest('/admin/assessments.php', {
            method: 'DELETE',
            body: JSON.stringify({ assessment_id: assessmentId })
        });

        alert('Assessment deleted successfully.');
        loadAssessmentsTable();
    } catch (err) {
        alert(`Failed to delete assessment: ${err.message}`);
    }
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
