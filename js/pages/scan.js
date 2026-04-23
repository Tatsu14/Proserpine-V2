import { showConfirmModal, showInfoModal, showLoader, hideLoader } from '../ui.js';
import { rechercherProduitParEAN } from '../api.js';

const btnBack = document.getElementById('btn-back');
const indicator = document.getElementById('scan-indicator');
let html5QrcodeScanner = null;
let isScanning = false;

btnBack.addEventListener('click', () => {
    stopScanAndGoBack();
});

async function stopScanAndGoBack() {
    if (html5QrcodeScanner && isScanning) {
        try {
            await html5QrcodeScanner.stop();
        } catch(e) {}
    }
    window.history.back();
}

// --- Logique Permissions & Initialisation Caméra ---
async function initCamera() {
    const permStatus = localStorage.getItem('camera_permission');
    
    if (permStatus === 'denied') {
        showConfirmModal(
            "Caméra non autorisée",
            "Vous avez refusé l'accès à la caméra. Sans cet accès, le scan est impossible.",
            "Autoriser",
            "Refuser à nouveau",
            () => { requestPermission(); }
        );
        document.getElementById('modal-cancel-btn').addEventListener('click', stopScanAndGoBack);
    } else if (!permStatus) {
        showConfirmModal(
            "Accès à la caméra",
            "Proserpine a besoin d'accéder à votre caméra pour scanner les codes-barres des produits.",
            "Autoriser",
            "Refuser",
            () => { requestPermission(); }
        );
        document.getElementById('modal-cancel-btn').addEventListener('click', () => {
            localStorage.setItem('camera_permission', 'denied');
            showInfoModal(
                "Fonctionnalités limitées",
                "Sans accès à la caméra, la majorité des fonctionnalités de Proserpine seront inaccessibles, notamment le scan de produits.",
                "Compris",
                stopScanAndGoBack
            );
        });
    } else {
        startScanner();
    }
}

async function requestPermission() {
    try {
        // Déclenche le prompt natif du navigateur
        await navigator.mediaDevices.getUserMedia({ video: true });
        localStorage.setItem('camera_permission', 'granted');
        startScanner();
    } catch (err) {
        localStorage.setItem('camera_permission', 'denied');
        showInfoModal(
            "Erreur d'accès",
            "Impossible d'accéder à la caméra. Veuillez vérifier vos paramètres système.",
            "Compris",
            stopScanAndGoBack
        );
    }
}

function startScanner() {
    html5QrcodeScanner = new Html5Qrcode("reader");
    
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 154 }, // ~ratio 1.618
        aspectRatio: 1.0,
        formatsToSupport: [ Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8 ]
    };
    
    // Masquer les éléments UI injectés par Html5Qrcode qu'on ne veut pas
    // (on utilise notre propre UI)
    
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).then(() => {
        isScanning = true;
        // Masquer le bouton de pause/arrêt injecté par la lib
        const videoEl = document.querySelector('#reader video');
        if (videoEl) videoEl.style.objectFit = 'cover';
    }).catch((err) => {
        console.error("Error starting scanner", err);
        showInfoModal("Erreur", "Impossible de démarrer la caméra.", "Retour", stopScanAndGoBack);
    });
}

let lastScannedCode = null;
let isProcessing = false;

async function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return;
    isProcessing = true;
    lastScannedCode = decodedText;
    
    indicator.textContent = "Code-barre détecté !";
    if (navigator.vibrate) navigator.vibrate(100);
    
    try {
        await html5QrcodeScanner.stop();
        isScanning = false;
    } catch(e) {}
    
    showLoader('Recherche du produit...');
    
    // Appel à l'API
    const produit = await rechercherProduitParEAN(decodedText);
    
    hideLoader();
    
    if (produit) {
        // Stocker temporairement dans sessionStorage pour éviter de re-fetch sur la page produit
        sessionStorage.setItem('temp_produit_scan', JSON.stringify(produit));
        window.location.replace(`produit.html?ean=${decodedText}&from=scan`);
    } else {
        showConfirmModal(
            "Produit non trouvé",
            "Ce produit n'est pas encore référencé dans notre base de données.",
            "Scanner à nouveau",
            "Rechercher manuellement",
            () => { 
                isProcessing = false;
                indicator.textContent = "Pointez la caméra vers un code-barre";
                startScanner(); 
            }
        );
        
        // Remplacer le noeud pour enlever tous les events
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        newCancelBtn.addEventListener('click', () => {
            window.location.replace(`recherche.html?q=${decodedText}`);
        });
    }
}

function onScanFailure(error) {
    // Silencieux, déclenché à chaque frame non détectée
}

// Lancer le flux
document.addEventListener('DOMContentLoaded', initCamera);
