import { initAuth } from '../auth.js';
import { db } from '../firebase.js';
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

document.getElementById('btn-back').addEventListener('click', () => {
    window.history.back();
});

initAuth().then(user => {
    if (user) {
        loadFullHistory(user.uid);
    }
});

async function loadFullHistory(uid) {
    const listEl = document.getElementById('history-list');
    
    try {
        const histRef = collection(db, 'utilisateurs', uid, 'historique');
        const q = query(histRef, orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        
        listEl.innerHTML = '';
        
        if (querySnapshot.empty) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded text-light fs-48 mb-4">history</span>
                    <p>Votre historique est vide.</p>
                </div>
            `;
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const ean = data.ean || doc.id;
            
            let dateStr = "";
            if (data.date && data.date.toDate) {
                const dateObj = data.date.toDate();
                dateStr = dateObj.toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric'
                });
            }
            
            const itemHTML = `
                <div class="history-item" onclick="window.location.href='produit.html?ean=${ean}'">
                    <div class="history-item-icon">
                        <span class="material-symbols-rounded">package_2</span>
                    </div>
                    <div class="history-item-info">
                        <div class="history-item-name">${data.nom || 'Produit inconnu'}</div>
                        <div class="history-item-brand">${dateStr}</div>
                    </div>
                    <span class="material-symbols-rounded text-light">chevron_right</span>
                </div>
            `;
            listEl.insertAdjacentHTML('beforeend', itemHTML);
        });
    } catch (e) {
        console.error(e);
        listEl.innerHTML = `<p class="text-muted text-center mt-8">Erreur lors du chargement de l'historique.</p>`;
    }
}
