/// <reference types="vite/client" />

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Determine if Firebase is fully and correctly configured in the client environment
const isFirebaseConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'undefined'
);

console.log('[FIREBASE_AUDIT] Checking configuration:', {
  isFirebaseConfigured,
  apiKeyLoaded: !!import.meta.env.VITE_FIREBASE_API_KEY,
  projectIdLoaded: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
});

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    console.log('[FIREBASE_AUDIT] Firebase initialized successfully.');
  } catch (error) {
    console.error('[FIREBASE_AUDIT] Firebase initialization failed:', error);
  }
} else {
  console.warn('[FIREBASE_AUDIT] Firebase is unconfigured. Running in offline/mock local database mode.');
}

// Initialize Firebase services safely (fallback to null if not configured)
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider, isFirebaseConfigured };

