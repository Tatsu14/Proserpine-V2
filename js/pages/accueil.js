import { initAuth } from '../auth.js';
import { initNavigation } from '../navigation.js';
import { db } from '../firebase.js';
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Initialiser l'auth
initAuth().then(user => {
    if (user) {
        document.getElementById('user-display-name').textContent = user.displayName || user.email.split('@')[0];
        loadRecentHistory(user.uid);
    }
});

// Initialiser la navigation
initNavigation('accueil');

// Ajouter une délégation d'événements pour les clics sur les items de l'historique
document.getElementById('history-container').addEventListener('click', (e) => {
    const item = e.target.closest('.history-item');
    if (item && item.dataset.ean) {
        window.location.href = `produit.html?ean=${item.dataset.ean}`;
    }
});

async function loadRecentHistory(uid) {
    const container = document.getElementById('history-container');
    
    try {
        const histRef = collection(db, 'utilisateurs', uid, 'historique');
        const q = query(histRef, orderBy('date', 'desc'), limit(5));
        
        const querySnapshot = await getDocs(q);
        
        container.innerHTML = ''; // Nettoyer les skeletons
        
        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="empty-history">
                    <span class="material-symbols-rounded empty-icon">history</span>
                    <p class="mb-4">Vous n'avez pas encore effectué de recherche. Scannez ou recherchez un produit pour commencer !</p>
                    <a href="scan.html" class="btn-secondary d-inline-flex text-decoration-none">Scanner un produit</a>
                </div>
            `;
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const ean = data.ean || doc.id;
            
            const itemHTML = `
                <div class="history-item" data-ean="${ean}">
                    <div class="history-item-icon">
                        <span class="material-symbols-rounded">package_2</span>
                    </div>
                    <div class="history-item-info">
                        <div class="history-item-name">${data.nom || 'Produit inconnu'}</div>
                        <div class="history-item-brand">${data.marque || 'Marque inconnue'}</div>
                    </div>
                    <span class="material-symbols-rounded text-border">chevron_right</span>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', itemHTML);
        });
        
    } catch (error) {
        console.error("Erreur chargement historique:", error);
        container.innerHTML = `<div class="empty-history">Erreur lors du chargement de l'historique.</div>`;
    }
}
