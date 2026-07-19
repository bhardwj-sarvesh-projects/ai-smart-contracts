import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase/firebase';
import { AuthService, UserProfile } from '../firebase/authService';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  signup: (email: string, password: string, fullName: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Simulate/Restore active offline session
      const offlineUserStr = localStorage.getItem('offline_user');
      if (offlineUserStr) {
        try {
          setUser(JSON.parse(offlineUserStr));
        } catch (_) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          const profile = await AuthService.getUserProfile(firebaseUser.uid);
          if (profile) {
            setUser(profile);
          } else {
            // Document might be in the process of being created (e.g., during sign up)
            setUser({
              uid: firebaseUser.uid,
              fullName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'user',
              isActive: true,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              photoURL: firebaseUser.photoURL || '',
              preferences: {},
              aiSettings: {}
            });
          }
        } catch (error) {
          console.error('[AUTH_CONTEXT] Error fetching user profile:', error);
          setUser({
            uid: firebaseUser.uid,
            fullName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            role: 'user',
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            photoURL: firebaseUser.photoURL || '',
            preferences: {},
            aiSettings: {}
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);


  const login = async (email: string, password: string): Promise<UserProfile> => {
    try {
      const profile = await AuthService.login(email, password);
      setUser(profile);
      return profile;
    } catch (error) {
      throw error;
    }
  };

  const signup = async (email: string, password: string, fullName: string): Promise<UserProfile> => {
    try {
      const profile = await AuthService.signup(email, password, fullName);
      setUser(profile);
      return profile;
    } catch (error) {
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await AuthService.logout();
      setUser(null);
    } catch (error) {
      throw error;
    }
  };

  const forgotPassword = async (email: string): Promise<void> => {
    try {
      await AuthService.forgotPassword(email);
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, forgotPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
