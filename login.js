// Form Switching
function switchForm(formType) {
    event.preventDefault();
    
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
        // Simulate login process
        loginUser(email, password);
    }
});

// Register Form Submission
document.getElementById('registerForm').addEventListener('submit', function (e) {
    e.preventDefault();
    
    // Clear previous errors
    clearError('registerNameError');
    clearError('registerEmailError');
    clearError('registerSchoolError');
    clearError('registerGradeError');
    clearError('registerPasswordError');
    clearError('registerConfirmPasswordError');
    clearError('termsError');
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const school = document.getElementById('registerSchool').value.trim();
    const grade = document.getElementById('registerGrade').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const termsChecked = document.getElementById('termsCheckbox').checked;
    
    let isValid = true;
    
    // Validation
    if (!name) {
        showError('registerNameError', 'Full name is required');
        isValid = false;
    } else if (name.length < 2) {
        showError('registerNameError', 'Name must be at least 2 characters');
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
        // Simulate registration process
        registerUser(name, email, school, grade, password);
    }
});

// Login User Function
function loginUser(email, password) {
    const loginBtn = document.querySelector('#loginForm .auth-btn');
    loginBtn.disabled = true;
    loginBtn.classList.add('btn-loading');
    loginBtn.textContent = '';
    
    // Simulate API call
    setTimeout(() => {
        // Store user session
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', email.split('@')[0]);
        localStorage.setItem('isAuthenticated', 'true');
        
        // Redirect to main app
        window.location.href = 'main.html';
    }, 1500);
}

// Register User Function
function registerUser(name, email, school, grade, password) {
    const registerBtn = document.querySelector('#registerForm .auth-btn');
    registerBtn.disabled = true;
    registerBtn.classList.add('btn-loading');
    registerBtn.textContent = '';
    
    // Simulate API call
    setTimeout(() => {
        // Store user session
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', name);
        localStorage.setItem('userSchool', school);
        localStorage.setItem('userGrade', grade);
        localStorage.setItem('isAuthenticated', 'true');
        
        // Redirect to main app
        window.location.href = 'main.html';
    }, 1500);
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
        alert('Social login integration coming soon!');
    });
});

// Prevent form submission on toggle form button
document.querySelectorAll('.toggle-form').forEach(btn => {
    btn.addEventListener('click', function (e) {
        e.preventDefault();
    });
});
