import { initAuth } from '../auth.js';
import { rechercherProduitParEAN } from '../api.js';
import { calculerEcoScore } from '../ecoscore.js';
import { analyserEmballage, CATEGORIES } from '../tri.js';
import { db } from '../firebase.js';
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

let currentUser = null;

initAuth().then(user => {
    currentUser = user;
    loadProductData();
});

function afficherTri(result) {
    const grid = document.getElementById('sorting-grid');
    const instructions = document.getElementById('sorting-instructions');

    if (result.composants.length === 0) {
        grid.innerHTML = `
            <div class="sorting-no-data">
                <span class="material-symbols-rounded">help_outline</span>
                <p>Pas assez de données disponibles pour connaître la façon de tri exact.</p>
            </div>`;
        return;
    }

    if (result.instructions) {
        instructions.textContent = result.instructions;
        instructions.classList.remove('d-none');
    }

    grid.innerHTML = result.composants.map(c => {
        const cat = CATEGORIES[c.categorie];
        return `
            <a href="guide-detail.html?type=${cat.guideType}" class="sorting-card">
                <div class="sorting-icon-wrapper ${cat.cssClass}" style="color: ${cat.iconColor}">
                    <span class="material-symbols-rounded">${cat.icon}</span>
                </div>
                <div class="sorting-card-title">${cat.title}</div>
                <div class="sorting-card-sub">${c.description}</div>
            </a>`;
    }).join('');
}

document.getElementById('btn-back').addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get('from');
    if (from === 'scan') {
        window.location.href = 'accueil.html';
    } else if (from === 'search') {
        window.location.href = 'recherche.html';
    } else {
        window.history.back();
    }
});

async function loadProductData() {
    const urlParams = new URLSearchParams(window.location.search);
    const ean = urlParams.get('ean');
    
    if (!ean) {
        document.getElementById('prod-name').textContent = "Erreur : Aucun produit spécifié.";
        return;
    }
    
    let produit = null;
    const tempStr = sessionStorage.getItem('temp_produit_scan');
    if (tempStr) {
        const tempProd = JSON.parse(tempStr);
        if (tempProd.ean === ean) {
            produit = tempProd;
        }
        sessionStorage.removeItem('temp_produit_scan');
    }
    
    if (!produit) {
        produit = await rechercherProduitParEAN(ean);
    }
    
    if (!produit) {
        document.getElementById('prod-name').textContent = "Produit introuvable";
        return;
    }
    
    // Calcul de l'éco-score
    const resultScore = calculerEcoScore(produit.donnees_brutes);
    
    // Mise à jour de l'UI
    document.getElementById('prod-name').textContent = produit.nom;
    document.getElementById('prod-brand').textContent = produit.marque;
    
    document.getElementById('prod-ean').textContent = produit.ean;
    document.getElementById('prod-origin').textContent = produit.pays_origine || 'Non spécifié';
    
    const sourceMap = {
        'openfoodfacts': 'Open Food Facts',
        'openbeautyfacts': 'Open Beauty Facts',
        'openproductsfacts': 'Open Products Facts'
    };
    document.getElementById('prod-source').textContent = sourceMap[produit.source] || produit.source;
    
    // Animation Jauge
    const scoreValEl = document.getElementById('score-val');
    const scoreRingEl = document.getElementById('score-ring');
    const prodLabelEl = document.getElementById('prod-label');
    const analysisEl = document.getElementById('prod-analysis');
    
    scoreValEl.textContent = resultScore.score;
    scoreValEl.style.color = resultScore.color;
    scoreRingEl.style.stroke = resultScore.color;
    
    const circumference = 283;
    const offset = circumference - (resultScore.score / 100) * circumference;
    
    setTimeout(() => {
        scoreRingEl.style.strokeDashoffset = offset;
    }, 100);
    
    prodLabelEl.textContent = resultScore.label;
    prodLabelEl.style.color = resultScore.color;
    analysisEl.textContent = resultScore.detail;
    document.querySelector('.analysis-box').style.borderLeftColor = resultScore.color;
    document.querySelector('.analysis-title').style.color = resultScore.color;
    
    // Consignes de tri dynamiques
    afficherTri(analyserEmballage(produit.donnees_brutes));

    // Sauvegarder dans l'historique
    if (currentUser) {
        try {
            const histRef = doc(db, 'utilisateurs', currentUser.uid, 'historique', produit.ean);
            await setDoc(histRef, {
                ean: produit.ean,
                nom: produit.nom,
                marque: produit.marque,
                date: serverTimestamp()
            });
        } catch (e) {
            console.error("Erreur save history:", e);
        }
    }
}
