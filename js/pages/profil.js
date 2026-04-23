import { initAuth, logoutUser } from '../auth.js';
import { initNavigation } from '../navigation.js';
import { showConfirmModal, afficherPageIndisponible } from '../ui.js';

initAuth().then(user => {
    if (user) {
        document.getElementById('user-display-name').textContent = user.displayName || user.email.split('@')[0];
    }
});

initNavigation('profil');

// Redirection vers indisponible pour édition de profil
document.getElementById('btn-edit-profile').addEventListener('click', () => {
    afficherPageIndisponible();
});

// Logique de déconnexion
document.getElementById('btn-logout').addEventListener('click', () => {
    showConfirmModal(
        "Déconnexion",
        "Vous êtes sur le point de vous déconnecter. Confirmer ?",
        "Se déconnecter",
        "Annuler",
        async () => {
            const result = await logoutUser();
            if (!result.success) {
                alert("Erreur de déconnexion: " + result.error); // Fallback basique
            }
        }
    );
    
    // Custom styling for logout confirm button
    const confirmBtn = document.getElementById('modal-confirm-btn');
    if (confirmBtn) {
        confirmBtn.style.backgroundColor = 'var(--color-status-danger)';
    }
});
