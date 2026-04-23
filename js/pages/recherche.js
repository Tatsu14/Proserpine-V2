import { initAuth } from '../auth.js';
import { initNavigation } from '../navigation.js';
import { rechercherProduitParTexte } from '../api.js';
import { showLoader, hideLoader } from '../ui.js';
import { db } from '../firebase.js';
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

initAuth().then(user => {
    if (user) loadRecentHistory(user.uid);
});
initNavigation('recherche');

const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const searchForm = document.getElementById('search-form');
const recentContainer = document.getElementById('recent-container');
const resultsContainer = document.getElementById('results-container');
const resultsList = document.getElementById('results-list');

// Auto-focus au chargement
setTimeout(() => searchInput.focus(), 100);

// Gestion de la navigation via data-ean (Event Delegation)
document.getElementById('recent-list').addEventListener('click', (e) => {
    const item = e.target.closest('.list-item');
    if (item && item.dataset.ean) {
        window.location.href = `produit.html?ean=${item.dataset.ean}&from=search`;
    }
});

// --- Si on vient d'un scan non trouvé ---
const urlParams = new URLSearchParams(window.location.search);
const qParam = urlParams.get('q');
if (qParam) {
    searchInput.value = qParam;
    clearBtn.style.display = 'flex';
    performSearch(qParam);
}

// --- Debounce & Live Suggestions ---
let debounceTimer;

searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim();
    clearBtn.style.display = val.length > 0 ? 'flex' : 'none';
    
    clearTimeout(debounceTimer);
    
    if (val.length === 0) {
        recentContainer.style.display = 'block';
        resultsContainer.classList.add('d-none');
        resultsContainer.classList.remove('d-block');
        return;
    }
    
    debounceTimer = setTimeout(() => {
        performLiveSearch(val);
    }, 300);
});

clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    recentContainer.style.display = 'block';
    resultsContainer.classList.add('d-none');
    resultsContainer.classList.remove('d-block');
    searchInput.focus();
});

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = searchInput.value.trim();
    if (val.length > 0) {
        clearTimeout(debounceTimer);
        performSearch(val);
    }
});

async function performLiveSearch(term) {
    recentContainer.style.display = 'none';
    resultsContainer.classList.remove('d-none');
    resultsContainer.classList.add('d-block');
    resultsList.innerHTML = `<div class="list-item skeleton skeleton-item"></div>`;
    
    const results = await rechercherProduitParTexte(term);
    renderResults(results, true);
}

async function performSearch(term) {
    showLoader('Recherche en cours...');
    recentContainer.style.display = 'none';
    resultsContainer.classList.remove('d-none');
    resultsContainer.classList.add('d-block');
    
    const results = await rechercherProduitParTexte(term);
    hideLoader();
    renderResults(results, false);
}

function renderResults(results, isLive) {
    resultsList.innerHTML = '';
    
    if (results.length === 0) {
        resultsList.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-rounded search-off-icon">search_off</span>
                <p>Aucun produit trouvé pour cette recherche.</p>
                <a href="scan.html" class="btn-primary mt-4">Scanner un produit</a>
            </div>
        `;
        return;
    }
    
    const displayResults = isLive ? results.slice(0, 5) : results;
    
    displayResults.forEach(prod => {
        const item = document.createElement('div');
        item.className = 'list-item';
        // Utilisation d'un listener au lieu de onclick
        item.addEventListener('click', () => {
            sessionStorage.setItem('temp_produit_scan', JSON.stringify(prod));
            window.location.href = `produit.html?ean=${prod.ean}&from=search`;
        });
        
        item.innerHTML = `
            <div class="item-icon">
                <span class="material-symbols-rounded">package_2</span>
            </div>
            <div class="item-info">
                <div class="item-name">${prod.nom}</div>
                <div class="item-brand">${prod.marque}</div>
            </div>
        `;
        resultsList.appendChild(item);
    });
    
    if (isLive && results.length > 5) {
        const moreBtn = document.createElement('button');
        moreBtn.className = 'btn-secondary mt-2';
        moreBtn.textContent = `Voir tous les résultats (${results.length})`;
        moreBtn.addEventListener('click', () => performSearch(searchInput.value.trim()));
        resultsList.appendChild(moreBtn);
    }
}

async function loadRecentHistory(uid) {
    const listEl = document.getElementById('recent-list');
    listEl.innerHTML = `<div class="list-item skeleton skeleton-item"></div>`;
    
    try {
        const histRef = collection(db, 'utilisateurs', uid, 'historique');
        const q = query(histRef, orderBy('date', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        
        listEl.innerHTML = '';
        
        if (querySnapshot.empty) {
            listEl.innerHTML = `<p class="empty-recent">Pas de recherche récente.</p>`;
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const ean = data.ean || doc.id;
            
            const itemHTML = `
                <div class="list-item" data-ean="${ean}">
                    <div class="item-icon">
                        <span class="material-symbols-rounded">history</span>
                    </div>
                    <div class="item-info">
                        <div class="item-name">${data.nom || 'Produit inconnu'}</div>
                        <div class="item-brand">${data.marque || ''}</div>
                    </div>
                    <span class="material-symbols-rounded text-border">chevron_right</span>
                </div>
            `;
            listEl.insertAdjacentHTML('beforeend', itemHTML);
        });
    } catch (e) {
        listEl.innerHTML = `<p class="text-muted">Erreur lors du chargement des recherches récentes.</p>`;
    }
}
