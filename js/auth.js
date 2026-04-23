/**
 * auth.js - Gestion de l'authentification et protection des routes
 */
import { auth, db } from './firebase.js';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { showToast, showLoader, hideLoader, hideSplashScreen } from './ui.js';

// Variables globales de statut
let currentUser = null;
let authInitialized = false;

// Pages publiques (non protégées)
const publicPages = ['connexion.html', 'inscription.html', 'index.html', ''];

/**
 * Initialisation et protection des routes
 * Doit être appelé sur TOUTES les pages
 */
export function initAuth() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            authInitialized = true;
            hideSplashScreen();
            
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const isPublicPage = publicPages.includes(currentPage);
            
            // Si l'utilisateur n'est pas connecté et essaie d'accéder à une page protégée
            if (!user && !isPublicPage) {
                // Redirection vers la page de connexion
                const isRoot = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
                const prefix = isRoot ? 'pages/' : '';
                window.location.replace(`${prefix}connexion.html`);
            } 
            // Si l'utilisateur est connecté et est sur une page d'auth
            else if (user && (currentPage === 'connexion.html' || currentPage === 'inscription.html' || currentPage === 'index.html' || currentPage === '')) {
                // Redirection vers l'accueil
                const isRoot = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
                const prefix = isRoot ? 'pages/' : '';
                window.location.replace(`${prefix}accueil.html`);
            }
            
            resolve(user);
        });
    });
}

/**
 * Inscription d'un nouvel utilisateur
 */
export async function registerUser(email, password, username) {
    showLoader('Création du compte...');
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Mettre à jour le profil avec le nom d'utilisateur
        await updateProfile(user, { displayName: username });
        
        // Créer le document utilisateur dans Firestore
        await setDoc(doc(db, 'utilisateurs', user.uid), {
            username: username,
            email: email,
            createdAt: serverTimestamp()
        });
        
        hideLoader();
        return { success: true, user };
    } catch (error) {
        hideLoader();
        console.error("Erreur d'inscription:", error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Connexion d'un utilisateur existant
 */
export async function loginUser(email, password) {
    showLoader('Connexion en cours...');
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        hideLoader();
        return { success: true, user: userCredential.user };
    } catch (error) {
        hideLoader();
        console.error("Erreur de connexion:", error);
        return { success: false, error: "Adresse e-mail ou mot de passe incorrect." }; // Message générique selon specs
    }
}

/**
 * Déconnexion
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        // La redirection sera gérée par le listener onAuthStateChanged
        return { success: true };
    } catch (error) {
        console.error("Erreur de déconnexion:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Réinitialisation du mot de passe
 */
export async function resetPassword(email) {
    showLoader('Envoi de l\'e-mail...');
    try {
        await sendPasswordResetEmail(auth, email);
        hideLoader();
        return { success: true };
    } catch (error) {
        hideLoader();
        console.error("Erreur reset password:", error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Obtenir l'utilisateur actuel
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Messages d'erreur traduits
 */
function getAuthErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use': return 'Cette adresse e-mail est déjà utilisée.';
        case 'auth/invalid-email': return 'L\'adresse e-mail n\'est pas valide.';
        case 'auth/weak-password': return 'Le mot de passe est trop faible.';
        case 'auth/user-not-found': return 'Aucun utilisateur trouvé avec cette adresse e-mail.';
        case 'auth/wrong-password': return 'Adresse e-mail ou mot de passe incorrect.';
        default: return 'Une erreur est survenue. Veuillez réessayer.';
    }
}
