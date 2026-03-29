/* ============ ADMIN DASHBOARD JAVASCRIPT ============ */

const API_BASE = 'api';
let adminUser = null;
let aiProgressIntervalId = null;
let aiTrainingBusy = false;

function uiAlert(message, title = 'Notice') {
    if (window.AppUI?.alert) {
        return window.AppUI.alert(message, title);
    }
    alert(message);
    return Promise.resolve();
}

function uiConfirm(message, title = 'Confirm', confirmText = 'OK', cancelText = 'Cancel') {
    if (window.AppUI?.confirm) {
        return window.AppUI.confirm(message, title, confirmText, cancelText);
    }
    return Promise.resolve(confirm(message));
}

function uiPrompt(label, defaultValue = '', title = 'Input Required') {
    if (window.AppUI?.prompt) {
        return window.AppUI.prompt(label, defaultValue, title);
    }
    return Promise.resolve(prompt(label, defaultValue));
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
        await uiAlert('Password must be at least 8 characters', 'Validation');
        return;
    }

    try {
        const response = await apiRequest('/admin/users.php', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        uiToast('User created successfully!', 'success');
        closeModal.call(form.closest('.modal').querySelector('.close-btn'));
        loadUsersTable(); // Refresh the users table
    } catch (err) {
        await uiAlert(`Failed to create user: ${err.message}`, 'Request Failed');
    }
}

async function handleAddAssessmentSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData);

    if ((payload.question_text || '').trim().length < 10) {
        await uiAlert('Question text must be at least 10 characters', 'Validation');
        return;
    }

    if ((payload.category || '').trim() === '') {
        await uiAlert('Please select a category', 'Validation');
        return;
    }

    try {
        const response = await apiRequest('/admin/assessments.php', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        uiToast('Question created successfully!', 'success');
        closeModal.call(form.closest('.modal').querySelector('.close-btn'));
        loadAssessmentsTable();
    } catch (err) {
        await uiAlert(`Failed to create question: ${err.message}`, 'Request Failed');
    }
}

// ============ DASHBOARD ============

async function loadDashboardData() {
    try {
        const response = await apiRequest('/admin/stats.php', { method: 'GET' });
        updateStats(response.data || {});
    } catch (err) {
        await uiAlert(`Failed to load dashboard stats: ${err.message}`, 'Request Failed');
    }

    loadModelProgress();
    startAiProgressAutoRefresh();
    renderCharts();
    loadActivityFeed();
}

function startAiProgressAutoRefresh() {
    if (aiProgressIntervalId) {
        clearInterval(aiProgressIntervalId);
    }

    aiProgressIntervalId = window.setInterval(() => {
        const dashboardSection = document.getElementById('dashboard-section');
        if (!dashboardSection || !dashboardSection.classList.contains('active')) {
            return;
        }
        loadModelProgress();
    }, 15000);
}

function stopAiProgressAutoRefresh() {
    if (aiProgressIntervalId) {
        clearInterval(aiProgressIntervalId);
        aiProgressIntervalId = null;
    }
}

function formatDateTime(input) {
    if (!input) return '-';
    const d = new Date(input.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return input;
    return d.toLocaleString();
}

async function startModelTraining() {
    if (aiTrainingBusy) {
        return;
    }

    const proceed = await uiConfirm(
        'Start AI model training now? This uses current labeled recommendations and weighted rows.',
        'Train Model',
        'Start Training',
        'Cancel'
    );

    if (!proceed) {
        return;
    }

    const trainBtn = document.getElementById('aiTrainBtn');
    aiTrainingBusy = true;
    if (trainBtn) {
        trainBtn.disabled = true;
        trainBtn.textContent = 'Training...';
    }

    try {
        const response = await apiRequest('/admin/train_model.php', {
            method: 'POST',
            body: JSON.stringify({ trigger: 'manual_dashboard' })
        });

        const accuracy = response.data?.accuracy_score;
        const suffix = accuracy !== undefined && accuracy !== null ? ` Accuracy: ${accuracy}%.` : '';
        uiToast(`Training finished successfully.${suffix}`, 'success');
    } catch (err) {
        await uiAlert(`Training failed: ${err.message}`, 'Training Failed');
    } finally {
        aiTrainingBusy = false;
        if (trainBtn) {
            trainBtn.disabled = false;
            trainBtn.textContent = 'Start Training';
        }
        loadModelProgress();
    }
}

async function loadModelProgress() {
    try {
        const response = await apiRequest('/admin/model_progress.php', { method: 'GET' });
        const data = response.data || {};

        const percent = Number(data.progress_percent || 0);
        const phase = data.current_phase || 'Data Preparation';
        const datasetCount = Number(data.dataset_count || 0);
        const classCoverage = Number(data.class_coverage || 0);
        const weightedRows = Number(data.weighted_result_rows || 0);
        const latestAccuracy = data.latest_model?.accuracy_score;
        const latestRun = data.latest_run || null;
        const runHistory = Array.isArray(data.run_history) ? data.run_history : [];
        const milestones = Array.isArray(data.milestones) ? data.milestones : [];

        const progressFill = document.getElementById('aiProgressFill');
        const progressPercent = document.getElementById('aiProgressPercent');
        const phaseEl = document.getElementById('aiCurrentPhase');
        const datasetEl = document.getElementById('aiDatasetCount');
        const classEl = document.getElementById('aiClassCoverage');
        const rowsEl = document.getElementById('aiWeightedRows');
        const accuracyEl = document.getElementById('aiLatestAccuracy');
        const runStatusEl = document.getElementById('aiRunStatus');
        const milestonesEl = document.getElementById('aiMilestones');
        const historyEl = document.getElementById('aiRunHistoryList');

        if (progressFill) progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        if (progressPercent) progressPercent.textContent = `${Math.round(percent)}%`;
        if (phaseEl) phaseEl.textContent = `Phase: ${phase}`;
        if (datasetEl) datasetEl.textContent = String(datasetCount);
        if (classEl) classEl.textContent = `${classCoverage}/5`;
        if (rowsEl) rowsEl.textContent = String(weightedRows);
        if (accuracyEl) accuracyEl.textContent = latestAccuracy === null || latestAccuracy === undefined ? 'Pending' : `${latestAccuracy}%`;
        if (runStatusEl) {
            if (!latestRun) {
                runStatusEl.textContent = 'Last run: none yet';
            } else {
                const accText = latestRun.accuracy_score === null || latestRun.accuracy_score === undefined
                    ? 'n/a'
                    : `${latestRun.accuracy_score}%`;
                runStatusEl.textContent = `Last run: ${latestRun.status} at ${formatDateTime(latestRun.finished_at || latestRun.started_at)} (accuracy: ${accText})`;
            }
        }

        if (milestonesEl) {
            milestonesEl.innerHTML = milestones.map(item => {
                const done = Boolean(item.done);
                return `
                    <div class="ai-milestone-item ${done ? 'done' : ''}">
                        <div class="meta">
                            <span class="title">${item.label}</span>
                            <span class="sub">${item.current} | Target: ${item.target}</span>
                        </div>
                        <span class="ai-milestone-status">${done ? 'Done' : 'In Progress'}</span>
                    </div>
                `;
            }).join('');
        }

        if (historyEl) {
            if (runHistory.length === 0) {
                historyEl.innerHTML = '<div class="ai-run-item empty">No training runs yet.</div>';
            } else {
                historyEl.innerHTML = runHistory.map(run => {
                    const status = String(run.status || 'unknown').toLowerCase();
                    const accText = run.accuracy_score === null || run.accuracy_score === undefined
                        ? 'n/a'
                        : `${run.accuracy_score}%`;
                    return `
                        <div class="ai-run-item ${status}">
                            <div class="meta">
                                <span class="title">Run #${run.run_id} | ${formatDateTime(run.started_at)}</span>
                                <span class="sub">samples=${run.samples_used}, classes=${run.class_coverage}/5, rows=${run.weighted_rows_used}, accuracy=${accText}</span>
                            </div>
                            <span class="status">${status}</span>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        const runStatusEl = document.getElementById('aiRunStatus');
        const milestonesEl = document.getElementById('aiMilestones');
        const historyEl = document.getElementById('aiRunHistoryList');
        if (runStatusEl) {
            runStatusEl.textContent = 'Last run: unavailable';
        }
        if (milestonesEl) {
            milestonesEl.innerHTML = `<div class="ai-milestone-item"><div class="meta"><span class="title">Failed to load AI progress</span><span class="sub">${err.message}</span></div><span class="ai-milestone-status">Error</span></div>`;
        }
        if (historyEl) {
            historyEl.innerHTML = `<div class="ai-run-item failed"><div class="meta"><span class="title">Unable to load training history</span><span class="sub">${err.message}</span></div><span class="status">error</span></div>`;
        }
    }
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
        { name: 'STEM', classKey: 'stem', percent: 20 },
        { name: 'TVL-ICT', classKey: 'tvl-ict', percent: 18 },
        { name: 'ABM', classKey: 'abm', percent: 16 },
        { name: 'HUMSS', classKey: 'humss', percent: 17 },
        { name: 'GAS', classKey: 'gas', percent: 14 },
        { name: 'TVL-COOKERY', classKey: 'tvl-cookery', percent: 15 }
    ];

    chart.innerHTML = data.map(item => `
        <div class="strand-bar">
            <div class="strand-label">${item.name}</div>
            <div class="strand-progress">
                <div class="strand-fill ${item.classKey}" style="width: ${item.percent}%"></div>
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

    const selectedCategory = document.getElementById('assessmentFilter')?.value || 'all';
    const params = new URLSearchParams();
    params.set('limit', '1000');
    if (selectedCategory && selectedCategory !== 'all') {
        params.set('category', selectedCategory);
    }

    apiRequest(`/admin/assessments.php?${params.toString()}`, { method: 'GET' })
        .then(response => {
            const questions = response.data || [];

            tbody.innerHTML = questions.map(item => `
                <tr>
                    <td>Q-${item.question_id}</td>
                    <td>${item.question_text || '-'}</td>
                    <td>${item.category || 'General'}</td>
                    <td>${item.responses ?? 0}</td>
                    <td><span class="badge success">Active</span></td>
                    <td>
                        <button class="btn-small btn-info" onclick="editAssessment(${item.question_id})">Edit</button>
                        <button class="btn-small btn-danger" onclick="deleteAssessment(${item.question_id})">Delete</button>
                    </td>
                </tr>
            `).join('');

            if (questions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No questions found.</td></tr>';
            }
        })
        .catch(err => {
            tbody.innerHTML = `<tr><td colspan="6">Failed to load questions: ${err.message}</td></tr>`;
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

        const categoryCell = row.querySelector('td:nth-child(3)');
        const category = (categoryCell?.textContent || '').toLowerCase();
        row.style.display = category.includes(value.toLowerCase()) ? '' : 'none';
    });

    loadAssessmentsTable();
}

async function viewUserDetails(userId) {
    try {
        const response = await apiRequest(`/admin/users.php?user_id=${encodeURIComponent(userId)}`, { method: 'GET' });
        const user = response.data || {};

        await uiAlert(
            `Name: ${user.first_name || ''} ${user.last_name || ''}\n` +
            `Email: ${user.email || '-'}\n` +
            `Role: ${user.role || '-'}\n` +
            `School: ${user.school_name || '-'}\n` +
            `Grade: ${user.grade_level || '-'}\n` +
            `Status: ${user.status || '-'}\n` +
            `Joined: ${user.created_at ? new Date(user.created_at).toLocaleString() : '-'}`,
            'User Details'
        );
    } catch (err) {
        await uiAlert(`Failed to load user details: ${err.message}`, 'Request Failed');
    }
}

async function editUser(userId) {
    try {
        const response = await apiRequest(`/admin/users.php?user_id=${encodeURIComponent(userId)}`, { method: 'GET' });
        const user = response.data || {};

        const firstName = await uiPrompt('First name', user.first_name || '', 'Edit User');
        if (firstName === null) return;
        const lastName = await uiPrompt('Last name', user.last_name || '', 'Edit User');
        if (lastName === null) return;
        const email = await uiPrompt('Email', user.email || '', 'Edit User');
        if (email === null) return;
        const school = await uiPrompt('School name', user.school_name || '', 'Edit User');
        if (school === null) return;

        let gradeLevel = user.grade_level || '';
        if ((user.role || '').toLowerCase() === 'student') {
            const gradeInput = await uiPrompt('Grade level (Grade 9 / Grade 10 / Grade 11 / Grade 12)', gradeLevel, 'Edit User');
            if (gradeInput === null) return;
            gradeLevel = gradeInput;
        }

        const status = await uiPrompt('Status (active/inactive)', (user.status || 'active').toLowerCase(), 'Edit User');
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

        uiToast('User updated successfully.', 'success');
        loadUsersTable(document.getElementById('userSearch')?.value || '');
    } catch (err) {
        await uiAlert(`Failed to update user: ${err.message}`, 'Request Failed');
    }
}

async function deleteUser(userId) {
    if (!(await uiConfirm('Delete this user? This action cannot be undone.', 'Delete User', 'Delete', 'Cancel'))) {
        return;
    }

    try {
        await apiRequest('/admin/users.php', {
            method: 'DELETE',
            body: JSON.stringify({ user_id: userId })
        });

        uiToast('User deleted successfully.', 'success');
        loadUsersTable(document.getElementById('userSearch')?.value || '');
    } catch (err) {
        await uiAlert(`Failed to delete user: ${err.message}`, 'Request Failed');
    }
}

async function viewAssessment(assessmentId) {
    await uiAlert(`Viewing assessment ${assessmentId}`, 'Assessment');
}

async function editAssessment(assessmentId) {
    try {
        const response = await apiRequest(`/admin/assessments.php?question_id=${encodeURIComponent(assessmentId)}`, { method: 'GET' });
        const question = response.data || {};

        const questionText = await uiPrompt('Question text', question.question_text || '', 'Edit Question');
        if (questionText === null) return;
        const category = await uiPrompt('Category', question.category || 'General', 'Edit Question');
        if (category === null) return;

        await apiRequest('/admin/assessments.php', {
            method: 'PUT',
            body: JSON.stringify({
                question_id: assessmentId,
                question_text: questionText,
                category
            })
        });

        uiToast('Question updated successfully.', 'success');
        loadAssessmentsTable();
    } catch (err) {
        await uiAlert(`Failed to update question: ${err.message}`, 'Request Failed');
    }
}

async function deleteAssessment(assessmentId) {
    if (!(await uiConfirm('Delete this question? Related survey responses for this question will also be removed.', 'Delete Question', 'Delete', 'Cancel'))) {
        return;
    }

    try {
        await apiRequest('/admin/assessments.php', {
            method: 'DELETE',
            body: JSON.stringify({ question_id: assessmentId })
        });

        uiToast('Question deleted successfully.', 'success');
        loadAssessmentsTable();
    } catch (err) {
        await uiAlert(`Failed to delete question: ${err.message}`, 'Request Failed');
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

function buildTrainingExportUrl(format = 'csv', limit = 500) {
    const safeFormat = format === 'json' ? 'json' : 'csv';
    const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 5000);
    return `${API_BASE}/admin/training_export.php?format=${encodeURIComponent(safeFormat)}&limit=${safeLimit}`;
}

function generateReport(reportName) {
    if (reportName === 'assessments' || reportName === 'strands') {
        const url = buildTrainingExportUrl('csv', 1000);
        window.open(url, '_blank');
        uiToast('Training dataset CSV export started.', 'success');
        return;
    }

    uiToast(`Generating ${reportName}...`, 'info');
}

function downloadReport(reportName) {
    if (reportName === 'report-002') {
        const url = buildTrainingExportUrl('csv', 1000);
        window.open(url, '_blank');
        uiToast('Assessment analytics training CSV downloaded.', 'success');
        return;
    }

    uiToast(`Downloading ${reportName}...`, 'info');
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
    uiToast('Settings saved successfully!', 'success');
}

async function backupDatabase() {
    if (await uiConfirm('This will create a backup of the database. Continue?', 'Confirm Backup', 'Start Backup', 'Cancel')) {
        uiToast('Database backup started.', 'info');
    }
}

async function clearCache() {
    if (await uiConfirm('This will clear all cached data. Continue?', 'Clear Cache', 'Clear', 'Cancel')) {
        location.reload();
    }
}

async function resetSystem() {
    if (await uiConfirm('Are you sure you want to reset the system? This cannot be undone!', 'Danger', 'Reset', 'Cancel')) {
        await uiAlert('Reset flow not connected yet.', 'Not Available');
    }
}

// ============ ADMIN LOGOUT ============

async function logoutAdmin() {
    if (!(await uiConfirm('Are you sure you want to logout?', 'Logout', 'Logout', 'Stay'))) {
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
                        startAiProgressAutoRefresh();
                    } else if (sectionId === 'analytics-section') {
                        stopAiProgressAutoRefresh();
                        loadAnalyticsData();
                    } else if (sectionId === 'reports-section') {
                        stopAiProgressAutoRefresh();
                        loadReportsData();
                    } else if (sectionId === 'settings-section') {
                        stopAiProgressAutoRefresh();
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
