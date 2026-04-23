/**
 * ui.js - Fonctions UI réutilisables (Toasts, Modals, Loaders)
 */

// Affiche un toast notification (type: 'success' ou 'error')
export function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Animation d'entrée
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Disparition après 3 secondes
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300); // Attend la fin de la transition
    }, 3000);
}

// Affiche un modal de confirmation avec deux boutons
export function showConfirmModal(title, message, confirmText, cancelText, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modalContent = `
        <div class="modal-content">
            <h3 class="modal-title">${title}</h3>
            <p class="modal-text">${message}</p>
            <div class="modal-actions">
                <button class="btn-primary" id="modal-confirm-btn">${confirmText}</button>
                <button class="btn-secondary" id="modal-cancel-btn">${cancelText}</button>
            </div>
        </div>
    `;
    
    overlay.innerHTML = modalContent;
    document.body.appendChild(overlay);
    
    // Déclenche l'animation
    setTimeout(() => overlay.classList.add('active'), 10);
    
    const close = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };
    
    document.getElementById('modal-cancel-btn').addEventListener('click', close);
    document.getElementById('modal-confirm-btn').addEventListener('click', () => {
        if(typeof onConfirm === 'function') onConfirm();
        close();
    });
}

// Affiche un modal d'information simple (un seul bouton)
export function showInfoModal(title, message, btnText, onConfirm = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modalContent = `
        <div class="modal-content">
            <h3 class="modal-title">${title}</h3>
            <p class="modal-text">${message}</p>
            <div class="modal-actions">
                <button class="btn-primary" id="modal-info-btn">${btnText}</button>
            </div>
        </div>
    `;
    
    overlay.innerHTML = modalContent;
    document.body.appendChild(overlay);
    
    setTimeout(() => overlay.classList.add('active'), 10);
    
    const close = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };
    
    document.getElementById('modal-info-btn').addEventListener('click', () => {
        if(typeof onConfirm === 'function') onConfirm();
        close();
    });
}

// Affiche un overlay de chargement plein écran
export function showLoader(text = 'Chargement...') {
    if (document.getElementById('app-loader')) return;
    
    const loader = document.createElement('div');
    loader.id = 'app-loader';
    loader.className = 'full-loader-overlay';
    
    loader.innerHTML = `
        <div class="spinner"></div>
        <p class="text-small text-primary-bold">${text}</p>
    `;
    
    document.body.appendChild(loader);
}

// Masque l'overlay de chargement
export function hideLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) loader.remove();
}

// Masque le splash screen (s'il est présent)
export function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 300);
    }
}

// Navigation universelle vers la page d'indisponibilité
export function afficherPageIndisponible() {
    // On détermine la profondeur pour que le chemin vers pages/indisponible.html soit correct
    const isRoot = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    const prefix = isRoot ? 'pages/' : '';
    
    // On passe l'URL de retour pour que le bouton puisse nous ramener
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${prefix}indisponible.html?retour=${returnUrl}`;
}
