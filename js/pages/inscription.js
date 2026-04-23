import { initAuth, registerUser } from '../auth.js';

initAuth();

const form = document.getElementById('register-form');
const inputs = {
    username: document.getElementById('username'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    confirm: document.getElementById('confirm')
};
const errors = {
    username: document.getElementById('err-username'),
    email: document.getElementById('err-email'),
    password: document.getElementById('err-password'),
    confirm: document.getElementById('err-confirm')
};
const submitBtn = document.getElementById('submit-btn');
const authErrorDiv = document.getElementById('auth-error');

// Regex validation
const validators = {
    username: (val) => /^[a-zA-Z0-9_-]{3,20}$/.test(val),
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    password: (val) => /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/.test(val),
    confirm: (val) => val === inputs.password.value && val.length > 0
};

let state = { username: false, email: false, password: false, confirm: false };

const checkField = (field) => {
    const isValid = validators[field](inputs[field].value);
    state[field] = isValid;
    
    if (!isValid && inputs[field].value.length > 0) {
        inputs[field].classList.add('invalid');
        errors[field].classList.add('visible');
    } else {
        inputs[field].classList.remove('invalid');
        errors[field].classList.remove('visible');
    }
    
    submitBtn.disabled = !(state.username && state.email && state.password && state.confirm);
};

Object.keys(inputs).forEach(field => {
    inputs[field].addEventListener('blur', () => checkField(field));
    inputs[field].addEventListener('input', () => {
        if (inputs[field].classList.contains('invalid')) checkField(field);
        if (field === 'password' && inputs.confirm.value) checkField('confirm'); // Re-vérifier confirm si mdp change
    });
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    authErrorDiv.style.display = 'none';
    
    if (submitBtn.disabled) return;
    
    const result = await registerUser(
        inputs.email.value, 
        inputs.password.value, 
        inputs.username.value
    );
    
    if (!result.success) {
        authErrorDiv.textContent = result.error;
        authErrorDiv.style.display = 'block';
    }
});
