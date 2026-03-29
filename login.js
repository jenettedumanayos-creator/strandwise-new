const API_BASE = 'api';
const DEFAULT_ADMIN_EMAIL = 'admin@gmail.com';

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

// Form Switching
function switchForm(formType, evt) {
    if (evt) {
        evt.preventDefault();
    }

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (formType === 'login') {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
}

function setSelectedUserType(type) {
    const userTypeInput = document.getElementById('userTypeInput');
    const userTypeButtons = document.querySelectorAll('.user-type-btn');

    userTypeButtons.forEach((btn) => {
        const isActive = btn.getAttribute('data-type') === type;
        btn.classList.toggle('active', isActive);
    });

    if (userTypeInput) {
        userTypeInput.value = type;
    }
}

function maybeAutoSelectAdminByEmail(email) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (normalizedEmail === DEFAULT_ADMIN_EMAIL) {
        setSelectedUserType('admin');
    }
}

// User Type Selector
document.addEventListener('DOMContentLoaded', async function() {
    const userTypeButtons = document.querySelectorAll('.user-type-btn');
    const loginEmailInput = document.getElementById('loginEmail');
    
    userTypeButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();

            setSelectedUserType(this.getAttribute('data-type'));
        });
    });

    if (loginEmailInput) {
        loginEmailInput.addEventListener('input', function() {
            maybeAutoSelectAdminByEmail(this.value);
        });

        loginEmailInput.addEventListener('blur', function() {
            maybeAutoSelectAdminByEmail(this.value);
        });
    }

    // If session already exists, redirect immediately based on role.
    try {
        const me = await apiRequest('/auth/me.php', { method: 'GET' });
        const role = (me.data.role || '').toLowerCase();
        persistSession(me.data);
        window.location.href = role === 'admin' ? 'admin.html' : 'main.html';
    } catch (err) {
        // No active session, stay on login page.
    }
});

function persistSession(user) {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', (user.role || 'student').toLowerCase());
    localStorage.setItem('userEmail', user.email || '');
    localStorage.setItem('userName', fullName || user.email || 'User');
    localStorage.setItem('userSchool', user.school_name || '');
    localStorage.setItem('userGrade', user.grade_level || '');
}

// Toggle Password Visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
}

// Password Strength Checker
function checkPasswordStrength(password) {
    let strength = 0;
    const strengthDiv = document.getElementById('passwordStrength');
    
    if (!strengthDiv) return;
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    strengthDiv.classList.remove('weak', 'medium', 'strong');
    
    if (strength <= 2) {
        strengthDiv.classList.add('weak');
    } else if (strength <= 3) {
        strengthDiv.classList.add('medium');
    } else {
        strengthDiv.classList.add('strong');
    }
}

// Email Validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Clear Error Message
function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
    }
    
    // Find associated input and remove error class
    const inputName = elementId.replace('Error', '');
    const inputElement = document.getElementById(inputName);
    if (inputElement) {
        inputElement.classList.remove('error');
    }
}

// Show Error Message
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
    }
    
    // Find associated input and add error class
    const inputName = elementId.replace('Error', '');
    const inputElement = document.getElementById(inputName);
    if (inputElement) {
        inputElement.classList.add('error');
    }
}

// Login Form Submission
document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    
    // Clear previous errors
    clearError('loginEmailError');
    clearError('loginPasswordError');
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    maybeAutoSelectAdminByEmail(email);
    
    let isValid = true;
    
    // Validation
    if (!email) {
        showError('loginEmailError', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showError('loginEmailError', 'Please enter a valid email');
        isValid = false;
    }
    
    if (!password) {
        showError('loginPasswordError', 'Password is required');
        isValid = false;
    } else if (password.length < 6) {
        showError('loginPasswordError', 'Password must be at least 6 characters');
        isValid = false;
    }
    
    if (isValid) {
        // Get selected user type from hidden input
        const userType = document.getElementById('userTypeInput').value;
        // Simulate login process
        loginUser(email, password, userType);
    }
});

// Register Form Submission
document.getElementById('registerForm').addEventListener('submit', function (e) {
    e.preventDefault();
    
    // Clear previous errors
    clearError('registerFirstNameError');
    clearError('registerLastNameError');
    clearError('registerEmailError');
    clearError('registerSchoolError');
    clearError('registerGradeError');
    clearError('registerPasswordError');
    clearError('registerConfirmPasswordError');
    clearError('termsError');
    
    const firstName = document.getElementById('registerFirstName').value.trim();
    const lastName = document.getElementById('registerLastName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const school = document.getElementById('registerSchool').value.trim();
    const grade = document.getElementById('registerGrade').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const termsChecked = document.getElementById('termsCheckbox').checked;
    
    let isValid = true;
    
    // Validation
    if (!firstName) {
        showError('registerFirstNameError', 'First name is required');
        isValid = false;
    } else if (firstName.length < 2) {
        showError('registerFirstNameError', 'First name must be at least 2 characters');
        isValid = false;
    }

    if (!lastName) {
        showError('registerLastNameError', 'Last name is required');
        isValid = false;
    } else if (lastName.length < 2) {
        showError('registerLastNameError', 'Last name must be at least 2 characters');
        isValid = false;
    }
    
    if (!email) {
        showError('registerEmailError', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showError('registerEmailError', 'Please enter a valid email');
        isValid = false;
    }
    
    if (!school) {
        showError('registerSchoolError', 'School name is required');
        isValid = false;
    }
    
    if (!grade) {
        showError('registerGradeError', 'Grade level is required');
        isValid = false;
    }
    
    if (!password) {
        showError('registerPasswordError', 'Password is required');
        isValid = false;
    } else if (password.length < 8) {
        showError('registerPasswordError', 'Password must be at least 8 characters');
        isValid = false;
    }
    
    if (!confirmPassword) {
        showError('registerConfirmPasswordError', 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('registerConfirmPasswordError', 'Passwords do not match');
        isValid = false;
    }
    
    if (!termsChecked) {
        showError('termsError', 'You must agree to the terms and conditions');
        isValid = false;
    }
    
    if (isValid) {
        registerUser(firstName, lastName, email, school, grade, password);
    }
});

// Login User Function
async function loginUser(email, password, userType = 'student') {
    const loginBtn = document.querySelector('#loginForm .auth-btn');
    loginBtn.disabled = true;
    loginBtn.classList.add('btn-loading');
    loginBtn.textContent = '';

    try {
        const response = await apiRequest('/auth/login.php', {
            method: 'POST',
            body: JSON.stringify({ email, password, userType })
        });

        persistSession(response.data);
        window.location.href = response.data.redirect || (response.data.role === 'admin' ? 'admin.html' : 'main.html');
    } catch (err) {
        showError('loginPasswordError', err.message || 'Login failed');
        loginBtn.disabled = false;
        loginBtn.classList.remove('btn-loading');
        loginBtn.textContent = 'Sign In';
    }
}

// Register User Function
async function registerUser(firstName, lastName, email, school, grade, password) {
    const registerBtn = document.querySelector('#registerForm .auth-btn');
    registerBtn.disabled = true;
    registerBtn.classList.add('btn-loading');
    registerBtn.textContent = '';

    try {
        const response = await apiRequest('/auth/register.php', {
            method: 'POST',
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                school,
                grade,
                password,
                userType: 'student'
            })
        });

        persistSession(response.data);
        window.location.href = 'main.html';
    } catch (err) {
        showError('registerEmailError', err.message || 'Registration failed');
        registerBtn.disabled = false;
        registerBtn.classList.remove('btn-loading');
        registerBtn.textContent = 'Create account';
    }
}

// Real-time Password Strength Check
document.getElementById('registerPassword')?.addEventListener('input', function () {
    checkPasswordStrength(this.value);
});

// Real-time Password Match Check
document.getElementById('registerConfirmPassword')?.addEventListener('input', function () {
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = this.value;
    
    if (confirmPassword && password !== confirmPassword) {
        document.getElementById('registerConfirmPassword').classList.add('error');
    } else {
        document.getElementById('registerConfirmPassword').classList.remove('error');
    }
});

// Email input real-time validation
document.getElementById('loginEmail')?.addEventListener('blur', function () {
    if (this.value && !isValidEmail(this.value)) {
        showError('loginEmailError', 'Please enter a valid email');
    } else {
        clearError('loginEmailError');
    }
});

document.getElementById('registerEmail')?.addEventListener('blur', function () {
    if (this.value && !isValidEmail(this.value)) {
        showError('registerEmailError', 'Please enter a valid email');
    } else {
        clearError('registerEmailError');
    }
});

// Social Login (Placeholder)
document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        uiToast('Social login integration coming soon!', 'info');
    });
});

// Prevent form submission on toggle form button
document.querySelectorAll('.toggle-form').forEach(btn => {
    btn.addEventListener('click', function (e) {
        e.preventDefault();
    });
});
