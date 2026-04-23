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

// Pages d'authentification (publiques)
const authPages = ['connexion.html', 'inscription.html'];

/**
 * Initialisation et protection des routes
 */
export function initAuth() {
    // Sécurité: masquer le splash screen après un délai si Firebase ne répond pas
    setTimeout(() => hideSplashScreen(), 3000);

    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            authInitialized = true;
            hideSplashScreen();
            
            const pathname = window.location.pathname;
            const rawFilename = pathname.split('/').pop();
            // Nettoyer le nom du fichier (enlever ?query= et #hash)
            const filename = rawFilename ? rawFilename.split('?')[0].split('#')[0] : '';
            const currentPage = filename === '' || !filename ? 'index.html' : filename;
            
            const isAuthPage = authPages.includes(currentPage);
            const isIndex = currentPage === 'index.html';
            
            // Logique de redirection
            if (!user) {
                // Si déconnecté et pas sur une page d'auth
                if (!isAuthPage) {
                    const prefix = isIndex ? 'pages/' : '';
                    // Éviter de rediriger si on est déjà sur connexion.html (sécurité supplémentaire)
                    if (currentPage !== 'connexion.html') {
                        window.location.replace(`${prefix}connexion.html`);
                    }
                }
            } else {
                // Si connecté et sur une page d'auth ou l'index
                if (isAuthPage || isIndex) {
                    const prefix = isIndex ? 'pages/' : '';
                    window.location.replace(`${prefix}accueil.html`);
                }
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
