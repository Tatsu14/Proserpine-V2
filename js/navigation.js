/**
 * navigation.js - Gestion de la barre de navigation
 */

const navHTML = `
<nav class="bottom-nav" id="bottom-navigation">
    <a href="accueil.html" class="nav-item" data-page="accueil">
        <span class="material-symbols-rounded">home</span>
        <span class="nav-label">Accueil</span>
    </a>
    <a href="recherche.html" class="nav-item" data-page="recherche">
        <span class="material-symbols-rounded">search</span>
        <span class="nav-label">Recherche</span>
    </a>
    <a href="scan.html" class="nav-scan-btn" id="nav-scan-btn">
        <span class="material-symbols-rounded">qr_code_scanner</span>
    </a>
    <a href="guide.html" class="nav-item" data-page="guide">
        <span class="material-symbols-rounded">menu_book</span>
        <span class="nav-label">Guide</span>
    </a>
    <a href="profil.html" class="nav-item" data-page="profil">
        <span class="material-symbols-rounded">account_circle</span>
        <span class="nav-label">Profil</span>
    </a>
</nav>
`;

/**
 * Initialise la barre de navigation sur la page courante
 * @param {string} activePage - L'identifiant de la page active ('accueil', 'recherche', 'guide', 'profil')
 */
export function initNavigation(activePage) {
    // Injecter le HTML de la nav à la fin du conteneur principal
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;
    
    // Éviter de l'injecter deux fois
    if (!document.getElementById('bottom-navigation')) {
        appContainer.insertAdjacentHTML('beforeend', navHTML);
    }
    
    // Gérer l'état actif
    const items = document.querySelectorAll('.nav-item');
    items.forEach(item => {
        if (item.getAttribute('data-page') === activePage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}
