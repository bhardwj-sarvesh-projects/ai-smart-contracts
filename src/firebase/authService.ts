import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut as firebaseSignOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: any;
  lastLogin: any;
  photoURL: string;
  preferences: Record<string, any>;
  aiSettings: Record<string, any>;
  securityQuestion?: string;
  securityAnswerHash?: string;
}

// Client-side SHA-256 helper for security answer hashing
async function hashAnswer(answer: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(answer.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const mapAuthError = (code: string): string => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/invalid-email':
      return 'Invalid email or password.';
    case 'auth/user-disabled':
      return 'Account disabled.';
    case 'auth/user-not-found':
      return 'User not found.';
    case 'auth/too-many-requests':
      return 'Too many login attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    default:
      return 'An unexpected authentication error occurred.';
  }
};

export const AuthService = {
  /**
   * Log in user with email and password
   */
  async login(email: string, password: string): Promise<UserProfile> {
    if (!isFirebaseConfigured || !auth || !db) {
      console.warn('[OFFLINE_MODE] Logging in locally (no Firebase config).');
      const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
      const found = Object.values(offlineDb).find((u: any) => u.email === email) as UserProfile | undefined;
      
      if (!found) {
        throw new Error('User not found. Since you are in local offline mode, please sign up to create a local profile.');
      }
      
      const profile: UserProfile = {
        ...found,
        lastLogin: new Date().toISOString()
      };
      localStorage.setItem('offline_user', JSON.stringify(profile));
      return profile;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      let profileData: UserProfile;
      
      try {
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          // Create user document if it doesn't exist
          const newUserProfile: UserProfile = {
            uid: firebaseUser.uid,
            fullName: firebaseUser.displayName || email.split('@')[0] || 'User',
            email: firebaseUser.email || email,
            role: 'user',
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            photoURL: firebaseUser.photoURL || '',
            preferences: {},
            aiSettings: {}
          };
          try {
            await setDoc(userDocRef, newUserProfile);
          } catch (writeErr) {
            console.warn('[FIRESTORE_FALLBACK] Failed to write profile to cloud, using local cache:', writeErr);
          }
          profileData = newUserProfile;
        } else {
          profileData = userDocSnap.data() as UserProfile;
        }
      } catch (firestoreErr) {
        console.warn('[FIRESTORE_FALLBACK] Firestore getDoc failed during login, using local fallback:', firestoreErr);
        // Attempt to load from local cache
        const cached = localStorage.getItem(`user_profile_${firebaseUser.uid}`);
        if (cached) {
          try {
            profileData = JSON.parse(cached);
          } catch (_) {
            profileData = {
              uid: firebaseUser.uid,
              fullName: firebaseUser.displayName || email.split('@')[0] || 'User',
              email: firebaseUser.email || email,
              role: 'user',
              isActive: true,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              photoURL: firebaseUser.photoURL || '',
              preferences: {},
              aiSettings: {}
            };
          }
        } else {
          profileData = {
            uid: firebaseUser.uid,
            fullName: firebaseUser.displayName || email.split('@')[0] || 'User',
            email: firebaseUser.email || email,
            role: 'user',
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            photoURL: firebaseUser.photoURL || '',
            preferences: {},
            aiSettings: {}
          };
        }
      }
      
      if (profileData.isActive === false) {
        throw new Error('auth/user-disabled');
      }
      
      // Update lastLogin timestamp safely
      try {
        await updateDoc(userDocRef, {
          lastLogin: new Date().toISOString()
        });
      } catch (updateErr) {
        console.warn('[FIRESTORE_FALLBACK] Failed to update lastLogin in Firestore:', updateErr);
      }
      
      // Cache profile locally
      localStorage.setItem(`user_profile_${firebaseUser.uid}`, JSON.stringify(profileData));
      
      return {
        ...profileData,
        uid: firebaseUser.uid,
        lastLogin: new Date().toISOString() // Provide instant local value for UI session
      };
    } catch (error: any) {
      if (error.code) {
        throw new Error(mapAuthError(error.code));
      }
      if (error.message === 'auth/user-disabled') {
        throw new Error('Account disabled.');
      }
      throw error;
    }
  },

  /**
   * Sign up a new user with email, password, full name, and security question
   */
  async signup(email: string, password: string, fullName: string, securityQuestion: string, securityAnswer: string): Promise<UserProfile> {
    const isOwner = email.trim().toLowerCase() === 'sarveshtiwarisarvesh@gmail.com';
    const role = isOwner ? 'admin' : 'user';
    const securityAnswerHash = await hashAnswer(securityAnswer);

    if (!isFirebaseConfigured || !auth || !db) {
      console.warn('[OFFLINE_MODE] Signing up user locally.');
      const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
      const exists = Object.values(offlineDb).some((u: any) => u.email === email);
      if (exists) {
        throw new Error('This email is already registered locally.');
      }
      const uid = 'offline_' + Math.random().toString(36).substr(2, 9);
      const userProfile: UserProfile = {
        uid: uid,
        fullName: fullName,
        email: email,
        role: role,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        photoURL: '',
        preferences: {},
        aiSettings: {},
        securityQuestion,
        securityAnswerHash
      };
      offlineDb[uid] = userProfile;
      localStorage.setItem('offline_users_db', JSON.stringify(offlineDb));
      localStorage.setItem('offline_user', JSON.stringify(userProfile));
      return userProfile;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      
      const userProfile: UserProfile = {
        uid: firebaseUser.uid,
        fullName: fullName,
        email: firebaseUser.email || email,
        role: role,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        photoURL: '',
        preferences: {},
        aiSettings: {},
        securityQuestion,
        securityAnswerHash
      };
      
      try {
        await setDoc(userDocRef, userProfile);
      } catch (firestoreErr) {
        console.warn('[FIRESTORE_FALLBACK] Failed to write profile to Firestore on signup:', firestoreErr);
      }
      
      // Cache profile locally
      localStorage.setItem(`user_profile_${firebaseUser.uid}`, JSON.stringify(userProfile));
      return userProfile;
    } catch (error: any) {
      if (error.code) {
        throw new Error(mapAuthError(error.code));
      }
      throw error;
    }
  },

  /**
   * Send password reset email
   */
  async forgotPassword(email: string): Promise<void> {
    if (!isFirebaseConfigured || !auth) {
      console.warn('[OFFLINE_MODE] Simulated password reset for:', email);
      return Promise.resolve();
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      if (error.code) {
        throw new Error(mapAuthError(error.code));
      }
      throw error;
    }
  },

  /**
   * Log out current user
   */
  async logout(): Promise<void> {
    if (!isFirebaseConfigured || !auth) {
      console.warn('[OFFLINE_MODE] Logging out locally.');
      localStorage.removeItem('offline_user');
      return Promise.resolve();
    }
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      if (error.code) {
        throw new Error(mapAuthError(error.code));
      }
      throw error;
    }
  },

  /**
   * Load a user profile from Firestore by UID
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!isFirebaseConfigured || !db) {
      const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
      return offlineDb[uid] || null;
    }
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data() as UserProfile;
        // Update local cache
        localStorage.setItem(`user_profile_${uid}`, JSON.stringify(data));
        return data;
      }
      return null;
    } catch (error) {
      console.warn('[FIRESTORE_FALLBACK] Failed to fetch user profile, checking local cache:', error);
      // Fallback to local cache
      const cached = localStorage.getItem(`user_profile_${uid}`);
      if (cached) {
        try {
          return JSON.parse(cached) as UserProfile;
        } catch (_) {}
      }
      return null;
    }
  },

  /**
   * Get the security question for a given email
   */
  async getSecurityQuestion(email: string): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();

    if (!isFirebaseConfigured || !auth || !db) {
      const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
      const found = Object.values(offlineDb).find((u: any) => u.email.toLowerCase() === cleanEmail) as UserProfile | undefined;
      if (!found) {
        throw new Error('User account not found.');
      }
      if (!found.securityQuestion) {
        throw new Error('This account does not have a security question configured.');
      }
      return found.securityQuestion;
    }

    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Fallback: check local profile cache
        const cachedKeys = Object.keys(localStorage).filter(k => k.startsWith('user_profile_'));
        for (const k of cachedKeys) {
          try {
            const p = JSON.parse(localStorage.getItem(k) || '{}');
            if (p.email?.toLowerCase() === cleanEmail) {
              if (p.securityQuestion) return p.securityQuestion;
            }
          } catch (_) {}
        }
        throw new Error('User account not found.');
      }

      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      if (!data.securityQuestion) {
        throw new Error('This account does not have a security question configured.');
      }
      return data.securityQuestion;
    } catch (err: any) {
      console.warn('[FIRESTORE_FALLBACK] Error getting security question:', err);
      // Fallback search local storage cache
      const cachedKeys = Object.keys(localStorage).filter(k => k.startsWith('user_profile_'));
      for (const k of cachedKeys) {
        try {
          const p = JSON.parse(localStorage.getItem(k) || '{}');
          if (p.email?.toLowerCase() === cleanEmail) {
            if (p.securityQuestion) return p.securityQuestion;
          }
        } catch (_) {}
      }
      throw new Error(err.message || 'Failed to retrieve security question.');
    }
  },

  /**
   * Verify the security answer for a given email
   */
  async verifySecurityAnswer(email: string, answer: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const inputHash = await hashAnswer(answer);

    if (!isFirebaseConfigured || !auth || !db) {
      const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
      const found = Object.values(offlineDb).find((u: any) => u.email.toLowerCase() === cleanEmail) as UserProfile | undefined;
      if (!found) {
        throw new Error('User account not found.');
      }
      if (found.securityAnswerHash === inputHash) {
        return true;
      }
      throw new Error('Incorrect answer to the security question.');
    }

    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('User account not found.');
      }

      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      if (data.securityAnswerHash === inputHash) {
        return true;
      }
      throw new Error('Incorrect answer to the security question.');
    } catch (err: any) {
      console.warn('[FIRESTORE_FALLBACK] Error verifying security answer:', err);
      // Fallback search cache
      const cachedKeys = Object.keys(localStorage).filter(k => k.startsWith('user_profile_'));
      for (const k of cachedKeys) {
        try {
          const p = JSON.parse(localStorage.getItem(k) || '{}');
          if (p.email?.toLowerCase() === cleanEmail) {
            if (p.securityAnswerHash === inputHash) return true;
          }
        } catch (_) {}
      }
      throw new Error(err.message || 'Failed to verify security answer.');
    }
  },

  /**
   * Update full name / display name in user profile
   */
  async updateProfileName(uid: string, newFullName: string): Promise<UserProfile> {
    if (!isFirebaseConfigured || !db) {
      const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
      if (offlineDb[uid]) {
        offlineDb[uid].fullName = newFullName;
        localStorage.setItem('offline_users_db', JSON.stringify(offlineDb));
      }
      const currentOffline = JSON.parse(localStorage.getItem('offline_user') || '{}');
      if (currentOffline && currentOffline.uid === uid) {
        currentOffline.fullName = newFullName;
        localStorage.setItem('offline_user', JSON.stringify(currentOffline));
      }
      return offlineDb[uid] || currentOffline;
    }
    
    try {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, { fullName: newFullName });
      
      if (auth && auth.currentUser) {
        const { updateProfile } = await import('firebase/auth');
        await updateProfile(auth.currentUser, { displayName: newFullName });
      }
      
      const updatedProfile = await this.getUserProfile(uid);
      if (updatedProfile) {
        localStorage.setItem(`user_profile_${uid}`, JSON.stringify(updatedProfile));
        return updatedProfile;
      }
      throw new Error('User profile not found after update');
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update display name.');
    }
  },

  /**
   * Change password for the current authenticated user
   */
  async changePassword(password: string): Promise<void> {
    if (!isFirebaseConfigured || !auth) {
      console.warn('[OFFLINE_MODE] Password change simulation');
      return;
    }
    try {
      if (auth.currentUser) {
        const { updatePassword } = await import('firebase/auth');
        await updatePassword(auth.currentUser, password);
      } else {
        throw new Error('No user is currently authenticated.');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update password.');
    }
  }
};

