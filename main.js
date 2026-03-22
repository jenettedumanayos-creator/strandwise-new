// Navigation between pages
function navigateToDashboard() {
    document.getElementById('landingPage').classList.remove('active');
    document.getElementById('dashboardPage').classList.add('active');
    scrollToTop();
}

function navigateToLanding() {
    document.getElementById('dashboardPage').classList.remove('active');
    document.getElementById('landingPage').classList.add('active');
    scrollToTop();
}

// Scroll to top
function scrollToTop() {
    window.scrollTo(0, 0);
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
