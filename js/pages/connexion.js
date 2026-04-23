import { initAuth, loginUser, resetPassword } from '../auth.js';
import { showToast } from '../ui.js';

// Initialiser l'auth pour rediriger si déjà connecté
initAuth();

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submit-btn');
const errorDiv = document.getElementById('auth-error');
const forgotBtn = document.getElementById('forgot-btn');

// Validation basique pour activer le bouton
const validateForm = () => {
    const isValid = emailInput.value && passwordInput.value.length >= 6;
    submitBtn.disabled = !isValid;
};

emailInput.addEventListener('input', validateForm);
passwordInput.addEventListener('input', validateForm);

// Soumission du formulaire
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';
    
    const result = await loginUser(emailInput.value, passwordInput.value);
    if (!result.success) {
        errorDiv.textContent = result.error;
        errorDiv.style.display = 'block';
    }
});

// Mot de passe oublié
forgotBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!emailInput.value) {
        errorDiv.textContent = "Veuillez entrer votre adresse e-mail puis cliquer sur Mot de passe oublié.";
        errorDiv.style.display = 'block';
        return;
    }
    
    const result = await resetPassword(emailInput.value);
    if (result.success) {
        showToast("Un e-mail de réinitialisation a été envoyé à votre adresse.", "success");
    } else {
        errorDiv.textContent = result.error;
        errorDiv.style.display = 'block';
    }
});
