// Check Authentication
function checkAuth() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Navigation between pages
function navigateToDashboard() {
    if (!checkAuth()) {
        return;
    }
    document.getElementById('landingPage').classList.remove('active');
    document.getElementById('dashboardPage').classList.add('active');
    scrollToTop();
    loadUserData();
}

function navigateToLanding() {
    document.getElementById('dashboardPage').classList.remove('active');
    document.getElementById('landingPage').classList.add('active');
    // Clear authentication on logout
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userSchool');
    localStorage.removeItem('userGrade');
    scrollToTop();
}

// Scroll to top
function scrollToTop() {
    window.scrollTo(0, 0);
}

// Load User Data
function loadUserData() {
    const userName = localStorage.getItem('userName') || 'User';
    const userEmail = localStorage.getItem('userEmail') || 'user@example.com';
    const userSchool = localStorage.getItem('userSchool') || 'Example School';
    const userGrade = localStorage.getItem('userGrade') || 'Grade 10';
    
    // Get user initials
    const initials = userName
        .split(' ')
        .map(name => name.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
    
    // Update user avatar
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
        userAvatar.textContent = initials;
    }
    
    // Update welcome message
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Hello, ${userName}! Welcome to your personal strand recommendation dashboard. This is your space to discover which academic strand aligns best with your interests, strengths, and career goals.`;
    }
    
    // Update profile section
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileSchool = document.getElementById('profileSchool');
    const profileGrade = document.getElementById('profileGrade');
    
    if (profileName) profileName.textContent = userName;
    if (profileEmail) profileEmail.textContent = userEmail;
    if (profileSchool) profileSchool.textContent = userSchool;
    if (profileGrade) profileGrade.textContent = userGrade;
}

// Sidebar toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

// Navigation menu items
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.content-section');

navLinks.forEach(link => {
    link.addEventListener('click', function () {
        const sectionId = this.getAttribute('data-section');

        // Remove active from all links
        navLinks.forEach(l => l.classList.remove('active'));
        // Add active to clicked link
        this.classList.add('active');

        // Hide all sections
        sections.forEach(section => section.classList.remove('active'));
        // Show selected section
        const section = document.getElementById(sectionId + '-section');
        if (section) {
            section.classList.add('active');
        }

        // Update header title
        const titles = {
            'home': 'Welcome Home',
            'assessment': 'Take Assessment',
            'results': 'Your Results',
            'explore': 'Explore Strands',
            'profile': 'Your Profile',
            'about': 'About StrandWise',
            'help': 'Help & Support'
        };
        document.getElementById('sectionTitle').textContent = titles[sectionId] || 'StrandWise';

        // Load user data when viewing profile
        if (sectionId === 'profile') {
            loadUserData();
        }

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.add('collapsed');
        }
    });
});

// Submit assessment function
function submitAssessment() {
    alert('Assessment submitted successfully! Check your Results tab to see your personalized strand recommendations.');
    // Simulate switching to results
    document.querySelector('[data-section="results"]').click();
}

// Scroll to section function
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.scrollIntoView({ behavior: 'smooth' });
    section.classList.add('active');
    // Activate the nav link
    document.querySelector(`[data-section="${sectionId.replace('-section', '')}"]`).click();
}

// Mobile menu adjustments
window.addEventListener('resize', function () {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth > 768) {
        sidebar.classList.remove('collapsed');
    }
});

// Smooth scrolling for anchor links
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
