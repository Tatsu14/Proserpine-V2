/**
 * firebase.js - Configuration Firebase
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBr3xbq87GeqjhKP866KjsmyDdvgPv_X30",
    authDomain: "proserpine-5eadf.firebaseapp.com",
    projectId: "proserpine-5eadf",
    storageBucket: "proserpine-5eadf.firebasestorage.app",
    messagingSenderId: "725919778618",
    appId: "1:725919778618:web:c31e2626ea083c37973203",
    measurementId: "G-SB4FYQV4G6"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Export des instances pour l'application
export const auth = getAuth(app);
export const db = getFirestore(app);
