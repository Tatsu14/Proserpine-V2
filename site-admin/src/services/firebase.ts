/**
 * Firebase — même projet que l'application (proserpine-5eadf) : mêmes comptes.
 * Ces clés sont des clés CLIENT publiques : la sécurité repose sur la fonction serveur
 * (base de produits) et sur les règles Firestore (retours), pas sur leur secret.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyBr3xbq87GeqjhKP866KjsmyDdvgPv_X30',
  authDomain: 'proserpine-5eadf.firebaseapp.com',
  projectId: 'proserpine-5eadf',
  storageBucket: 'proserpine-5eadf.firebasestorage.app',
  messagingSenderId: '725919778618',
  appId: '1:725919778618:web:c31e2626ea083c37973203',
});

export const auth = getAuth(app);
export const db = getFirestore(app);
