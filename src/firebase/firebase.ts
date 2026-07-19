import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration from existing environment setup
const firebaseConfig = {
  apiKey: "AIzaSyFakeKeyForPreviewSmartContractStudio",
  authDomain: "smartcontract-ai-studio.firebaseapp.com",
  projectId: "smartcontract-ai-studio",
  storageBucket: "smartcontract-ai-studio.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Initialize Firebase App using modular patterns
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
