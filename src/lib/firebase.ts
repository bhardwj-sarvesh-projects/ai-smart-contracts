import { initializeApp, getApps } from "firebase/app";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";

// Firebase configuration is supplied only through Vite environment variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;
let auth: any = null;


const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
try {
  if (firebaseConfigured) { app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]; auth = getAuth(app); }
} catch (err) { console.error('[FIREBASE] Client initialization failed:', err); auth = null; }

export { auth };

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export class AuthService {
  static getCurrentUser(): AppUser | null {
    const saved = localStorage.getItem("app_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  }

  static onUserChange(callback: (user: AppUser | null) => void) {
    // Return instant local storage state for fast rendering
    const initialUser = this.getCurrentUser();
    callback(initialUser);

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const u: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Developer",
            photoURL: firebaseUser.photoURL || "",
          };
          localStorage.setItem("app_user", JSON.stringify(u));
          callback(u);
        } else {
          if (!localStorage.getItem("app_user_offline")) {
            localStorage.removeItem("app_user");
            callback(null);
          }
        }
      });
      return unsubscribe;
    }
    return () => {};
  }

  static async loginWithGoogle(): Promise<AppUser> { throw new Error('Google sign-in is disabled. Use email/password authentication.'); }

  static async logout(): Promise<void> {
    localStorage.removeItem("app_user");
    localStorage.removeItem("app_user_offline");
    if (auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Firebase logout failed:", err);
      }
    }
  }
}
