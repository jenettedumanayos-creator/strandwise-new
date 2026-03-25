/* ============ ADMIN DASHBOARD JAVASCRIPT ============ */

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
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
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section') + '-section';
            
            // Remove active class from all
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked
            this.classList.add('active');
            document.getElementById(sectionId).classList.add('active');
        });
    });

    // Set initial active state
    document.querySelector('[data-section="dashboard"]').classList.add('active');
}

// ============ MODALS ============

function initializeModals() {
    // Close modal when clicking close button
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Close modal when clicking outside content
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal.call(this.querySelector('.close-btn'));
            }
        });
    });
}

function openAddUserModal() {
    document.getElementById('addUserModal').classList.add('show');
}

function openAddAssessmentModal() {
    document.getElementById('addAssessmentModal').classList.add('show');
}

function closeModal() {
    const modal = this.closest('.modal');
    if (modal) {
        modal.classList.remove('show');
        // Reset form
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

// Handle add user form submission
document.addEventListener('DOMContentLoaded', function() {
    const addUserForm = document.querySelector('#addUserModal form');
    if (addUserForm) {
        addUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = {
                name: this.querySelector('input[name="name"]').value,
                email: this.querySelector('input[name="email"]').value,
                school: this.querySelector('input[name="school"]').value,
                grade: this.querySelector('select[name="grade"]').value
            };
            
            // Here you would send data to backend
            console.log('New user:', formData);
            alert('User added successfully!');
            
            // Close modal and reset
            document.getElementById('addUserModal').classList.remove('show');
            this.reset();
            // Refresh table
            loadUsersTable();
        });
    }
});

// ============ DASHBOARD ============

function loadDashboardData() {
    // Update stats - in real app, fetch from backend
    updateStats();
    renderCharts();
    loadActivityFeed();
}

function updateStats() {
    // Mock data - replace with real API calls
    document.getElementById('totalUsers').textContent = '4,832';
    document.getElementById('assessmentsCompleted').textContent = '3,256';
    document.getElementById('averageScore').textContent = '78.5%';
    document.getElementById('activeSessions').textContent = '145';
}

function renderCharts() {
    renderStrandChart();
    renderUserGrowthChart();
}

function renderStrandChart() {
    const data = [
        { name: 'Science', percent: 28 },
        { name: 'Technology', percent: 32 },
        { name: 'Business', percent: 24 },
        { name: 'Arts', percent: 16 }
    ];

    const strandChart = document.getElementById('strandChart');
    if (strandChart) {
        strandChart.innerHTML = data.map(item => `
            <div class="strand-bar">
                <div class="strand-label">${item.name}</div>
                <div class="strand-progress">
                    <div class="strand-fill ${item.name.toLowerCase()}" style="width: ${item.percent}%"></div>
                </div>
                <div class="strand-percent">${item.percent}%</div>
            </div>
        `).join('');
    }
}

function renderUserGrowthChart() {
    const data = [45, 52, 38, 65, 71, 58, 82]; // 7 days
    const maxValue = Math.max(...data);
    
    const userChart = document.getElementById('userGrowthChart');
    if (userChart) {
        userChart.innerHTML = data.map((value, index) => {
            const height = (value / maxValue) * 100;
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            return `
                <div class="day-bar" style="height: ${height}%; min-height: 30px;" title="${days[index]}: ${value} users">
                </div>
            `;
        }).join('');
    }
}

function loadActivityFeed() {
    const activities = [
        { time: '2 hours ago', desc: 'New user registered: John Smith', type: 'user' },
        { time: '4 hours ago', desc: 'Assessment completed by Sarah Johnson', type: 'assessment' },
        { time: '6 hours ago', desc: 'New feedback received from Mike Davis', type: 'feedback' },
        { time: '8 hours ago', desc: 'System backup completed successfully', type: 'system' },
        { time: '1 day ago', desc: 'Report generated: Monthly Analytics', type: 'report' }
    ];

    const activityList = document.getElementById('activityFeed');
    if (activityList) {
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
}

// ============ USERS MANAGEMENT ============

function initializeTables() {
    loadUsersTable();
    loadAssessmentsTable();
    initializeSearch();
    initializeFilter();
}

function loadUsersTable() {
    const users = [
        { id: 1, name: 'John Smith', email: 'john@example.com', school: 'Central High', grade: '10th', status: 'Active', joined: '2024-01-15' },
        { id: 2, name: 'Sarah Johnson', email: 'sarah@example.com', school: 'Lincoln High', grade: '11th', status: 'Active', joined: '2024-01-18' },
        { id: 3, name: 'Mike Davis', email: 'mike@example.com', school: 'Washington High', grade: '12th', status: 'Inactive', joined: '2024-01-10' },
        { id: 4, name: 'Emma Wilson', email: 'emma@example.com', school: 'Jefferson High', grade: '10th', status: 'Active', joined: '2024-01-20' }
    ];

    const tbody = document.querySelector('#usersTable tbody');
    if (tbody) {
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.school}</td>
                <td>${user.grade}</td>
                <td><span class="badge ${user.status === 'Active' ? 'active' : 'warning'}">${user.status}</span></td>
                <td>${user.joined}</td>
                <td>
                    <button class="btn-small btn-info" onclick="viewUserDetails(${user.id})">View</button>
                    <button class="btn-small btn-danger" onclick="deleteUser(${user.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    }
}

function loadAssessmentsTable() {
    const assessments = [
        { id: 1, student: 'John Smith', submitted: '2024-02-15', score: '85%', strand: 'Technology', status: 'Completed' },
        { id: 2, student: 'Sarah Johnson', submitted: '2024-02-18', score: '92%', strand: 'Science', status: 'Completed' },
        { id: 3, student: 'Mike Davis', submitted: '2024-02-10', score: '78%', strand: 'Business', status: 'Completed' },
        { id: 4, student: 'Emma Wilson', submitted: '2024-02-20', score: 'In Progress', strand: 'Arts', status: 'Pending' }
    ];

    const tbody = document.querySelector('#assessmentsTable tbody');
    if (tbody) {
        tbody.innerHTML = assessments.map(assessment => `
            <tr>
                <td>${assessment.student}</td>
                <td>${assessment.submitted}</td>
                <td>${assessment.score}</td>
                <td>${assessment.strand}</td>
                <td><span class="badge ${assessment.status === 'Completed' ? 'success' : 'warning'}">${assessment.status}</span></td>
                <td>
                    <button class="btn-small btn-info" onclick="viewAssessment(${assessment.id})">View</button>
                    <button class="btn-small btn-danger" onclick="deleteAssessment(${assessment.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    }
}

function initializeSearch() {
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchUsers(this.value);
        });
    }
}

function initializeFilter() {
    const filterSelect = document.getElementById('assessmentFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            filterAssessments(this.value);
        });
    }
}

function searchUsers(query) {
    const rows = document.querySelectorAll('#usersTable tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    });
}

function filterAssessments(value) {
    const rows = document.querySelectorAll('#assessmentsTable tbody tr');
    rows.forEach(row => {
        if (value === 'all') {
            row.style.display = '';
        } else {
            const statusCell = row.querySelector('td:nth-child(5)');
            const status = statusCell.textContent.toLowerCase();
            row.style.display = status.includes(value) ? '' : 'none';
        }
    });
}

function viewUserDetails(userId) {
    alert(`Viewing details for user ${userId}`);
    // Implementation for viewing user details
}

function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        alert(`User ${userId} deleted successfully`);
        loadUsersTable();
    }
}

function viewAssessment(assessmentId) {
    alert(`Viewing assessment ${assessmentId}`);
    // Implementation for viewing assessment
}

function deleteAssessment(assessmentId) {
    if (confirm('Are you sure you want to delete this assessment?')) {
        alert(`Assessment ${assessmentId} deleted successfully`);
        loadAssessmentsTable();
    }
}

// ============ ANALYTICS ============

function loadAnalyticsData() {
    const analytics = [
        {
            title: 'Assessment Completion Rate',
            percent: 72,
            label: 'of students completed'
        },
        {
            title: 'Top Strand Distribution',
            items: [
                { name: 'Technology', count: 1200 },
                { name: 'Science', count: 950 },
                { name: 'Business', count: 820 },
                { name: 'Arts', count: 640 }
            ]
        },
        {
            title: 'Assessment Frequency',
            items: [
                { name: 'Daily', count: 145 },
                { name: 'Weekly', count: 320 },
                { name: 'Monthly', count: 456 },
                { name: 'Never', count: 89 }
            ]
        },
        {
            title: 'Device Distribution',
            items: [
                { name: 'Desktop', count: 2100 },
                { name: 'Mobile', count: 1890 },
                { name: 'Tablet', count: 542 }
            ]
        }
    ];

    // Update analytics cards
    const analyticsGrid = document.querySelector('.analytics-grid');
    if (analyticsGrid) {
        analyticsGrid.innerHTML = analytics.map(card => {
            if (card.percent !== undefined) {
                return `
                    <div class="analytics-card">
                        <h3>${card.title}</h3>
                        <div class="circle-stat">
                            <div class="circle">
                                <p class="percent">${card.percent}%</p>
                            </div>
                            <p class="label">${card.label}</p>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="analytics-card">
                        <h3>${card.title}</h3>
                        <ul class="analytics-list">
                            ${card.items.map(item => `
                                <li>
                                    <span>${item.name}</span>
                                    <span class="stat">${item.count.toLocaleString()}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
        }).join('');
    }
}

// ============ REPORTS ============

function loadReportsData() {
    const reports = [
        {
            name: 'Demographics Report',
            description: 'User demographics and enrollment data',
            icon: '📊'
        },
        {
            name: 'Assessment Analytics',
            description: 'Assessment completion and performance metrics',
            icon: '📈'
        },
        {
            name: 'Strand Recommendations',
            description: 'Strand distribution and recommendations',
            icon: '🎯'
        },
        {
            name: 'Performance Report',
            description: 'Student performance and progress tracking',
            icon: '⭐'
        }
    ];

    const reportsGrid = document.querySelector('.reports-grid');
    if (reportsGrid) {
        reportsGrid.innerHTML = reports.map(report => `
            <div class="report-card">
                <div style="font-size: 2rem; margin-bottom: 1rem;">${report.icon}</div>
                <h3>${report.name}</h3>
                <p>${report.description}</p>
                <button class="btn-primary" onclick="generateReport('${report.name}')">Generate</button>
            </div>
        `).join('');
    }

    const history = [
        { report: 'Demographics Report', date: '2024-02-18', size: '2.4 MB' },
        { report: 'Assessment Analytics', date: '2024-02-15', size: '1.8 MB' },
        { report: 'Performance Report', date: '2024-02-10', size: '3.2 MB' },
        { report: 'Strand Recommendations', date: '2024-02-05', size: '2.1 MB' }
    ];

    const historyList = document.querySelector('.history-list');
    if (historyList) {
        historyList.innerHTML = history.map(item => `
            <div class="history-item">
                <div style="flex: 1;">
                    <div style="font-weight: 500;">${item.report}</div>
                    <div class="date">${item.size}</div>
                </div>
                <div class="date">${item.date}</div>
                <button class="btn-small btn-info" onclick="downloadReport('${item.report}')">Download</button>
            </div>
        `).join('');
    }
}

function generateReport(reportName) {
    alert(`Generating ${reportName}...`);
    // Show loading state
    setTimeout(() => {
        alert(`${reportName} generated successfully!`);
        // Add to history
        loadReportsData();
    }, 2000);
}

function downloadReport(reportName) {
    alert(`Downloading ${reportName}...`);
    // Simulate download
}

// ============ SETTINGS ============

function initializeSettings() {
    loadSettings();
    const settingsForms = document.querySelectorAll('.settings-group form');
    settingsForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            saveSettings();
        });
    });
}

function loadSettings() {
    // Load settings from localStorage or backend
    const settings = {
        siteName: 'StrandWise',
        supportEmail: 'support@strandwise.com',
        timezone: 'UTC',
        language: 'English',
        emailNotifications: true,
        twoFactorAuth: false,
        apiEndpoint: 'https://api.strandwise.com'
    };

    // Populate form fields
    Object.keys(settings).forEach(key => {
        const input = document.querySelector(`[name="${key}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = settings[key];
            } else {
                input.value = settings[key];
            }
        }
    });
}

function saveSettings() {
    alert('Settings saved successfully!');
    // Send to backend
}

function backupDatabase() {
    if (confirm('This will create a backup of the database. Continue?')) {
        alert('Database backup started. This may take a few minutes...');
        // Simulate backup
        setTimeout(() => {
            alert('Database backup completed successfully!');
        }, 3000);
    }
}

function clearCache() {
    if (confirm('This will clear all cached data. Continue?')) {
        alert('Cache cleared successfully!');
        location.reload();
    }
}

function resetSystem() {
    if (confirm('Are you sure you want to reset the system? This cannot be undone!')) {
        if (confirm('This is irreversible. Are you absolutely sure?')) {
            alert('System reset initiated...');
            // Reset would occur
        }
    }
}

// ============ ADMIN LOGOUT ============

function logoutAdmin() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear session/localStorage
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('userType');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('adminToken');
        // Redirect to login
        window.location.href = 'login.html';
    }
}

// ============ AUTO-LOAD SECTIONS ============

// When page loads, check which section is active and load its data
document.addEventListener('DOMContentLoaded', function() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'class') {
                const target = mutation.target;
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

    // Initialize analytics and reports on first load if they're visible
    setTimeout(() => {
        loadAnalyticsData();
        loadReportsData();
    }, 500);
});
