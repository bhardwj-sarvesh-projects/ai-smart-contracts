import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthService, UserProfile } from '../lib/authService';
import { AppCache } from '../lib/cache';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  signup: (email: string, password: string, fullName: string, securityQuestion: string, securityAnswer: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updateProfileName: (newName: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Pre-load user instantly from cache if available to eliminate cold startup delays
  const [user, setUser] = useState<UserProfile | null>(() => {
    const cachedUser = AppCache.get<UserProfile>('session_user');
    if (cachedUser) return cachedUser;
    try {
      const offlineUserStr = localStorage.getItem('offline_user');
      return offlineUserStr ? JSON.parse(offlineUserStr) : null;
    } catch (_) {
      return null;
    }
  });

  // If cached user exists, set initial loading to false immediately for instant layout paint
  const [loading, setLoading] = useState<boolean>(() => {
    return AppCache.get('session_user') ? false : true;
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const offlineUserStr = localStorage.getItem('offline_user');
      if (offlineUserStr) {
        try {
          const parsed = JSON.parse(offlineUserStr);
          setUser(parsed);
          AppCache.set('session_user', parsed, 3600000);
        } catch (_) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
      return;
    }

    // Maximum timeout guard so auth initialization never blocks the UI indefinitely
    const authTimeoutGuard = setTimeout(() => {
      console.warn('[AUTH_CONTEXT] Supabase auth state listener initialization timeout reached. Force-releasing loading state.');
      setLoading(false);
    }, 2500);

    // 1. Initial check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const uid = session.user.id;
        const cachedUser = AppCache.get<UserProfile>('session_user');
        if (cachedUser && cachedUser.uid === uid) {
          setUser(cachedUser);
          setLoading(false);
        }

        AuthService.getUserProfile(uid).then((freshProfile) => {
          if (freshProfile) {
            setUser(freshProfile);
            AppCache.set('session_user', freshProfile, 3600000);
          }
          setLoading(false);
        }).catch(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    // 2. Listen to active auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      clearTimeout(authTimeoutGuard);
      if (session?.user) {
        const uid = session.user.id;
        try {
          const cachedUser = AppCache.get<UserProfile>('session_user');
          if (cachedUser && cachedUser.uid === uid) {
            setUser(cachedUser);
            setLoading(false);
            AuthService.getUserProfile(uid).then((freshProfile) => {
              if (freshProfile) {
                setUser(freshProfile);
                AppCache.set('session_user', freshProfile, 3600000);
              }
            }).catch(() => {});
            return;
          }

          const profile = await AuthService.getUserProfile(uid);
          const activeProfile = profile || {
            uid: session.user.id,
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            role: session.user.email?.trim().toLowerCase() === 'sarveshtiwarisarvesh@gmail.com' ? 'admin' : 'user',
            isActive: true,
            createdAt: session.user.created_at || new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            photoURL: session.user.user_metadata?.avatar_url || '',
            preferences: {},
            aiSettings: {},
          };

          setUser(activeProfile);
          AppCache.set('session_user', activeProfile, 3600000);
        } catch (error) {
          console.error('[AUTH_CONTEXT] Error fetching user profile:', error);
          const fallbackProfile: UserProfile = {
            uid: session.user.id,
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            role: 'user',
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            photoURL: '',
            preferences: {},
            aiSettings: {},
          };
          setUser(fallbackProfile);
          AppCache.set('session_user', fallbackProfile, 3600000);
        }
      } else {
        setUser(null);
        AppCache.invalidate('session_user');
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(authTimeoutGuard);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<UserProfile> => {
    const profile = await AuthService.login(email, password);
    setUser(profile);
    AppCache.set('session_user', profile, 3600000);
    return profile;
  }, []);

  const signup = useCallback(async (email: string, password: string, fullName: string, securityQuestion: string, securityAnswer: string): Promise<UserProfile> => {
    const profile = await AuthService.signup(email, password, fullName, securityQuestion, securityAnswer);
    setUser(profile);
    AppCache.set('session_user', profile, 3600000);
    return profile;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await AuthService.logout();
    setUser(null);
    AppCache.clear();
  }, []);

  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    await AuthService.forgotPassword(email);
  }, []);

  const updateProfileName = useCallback(async (newName: string): Promise<void> => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, fullName: newName };
      AppCache.set('session_user', updated, 3600000);
      return updated;
    });

    if (user) {
      const updatedProfile = await AuthService.updateProfileName(user.uid, newName);
      setUser(updatedProfile);
      AppCache.set('session_user', updatedProfile, 3600000);
    }
  }, [user]);

  const changePassword = useCallback(async (newPassword: string): Promise<void> => {
    await AuthService.changePassword(newPassword);
  }, []);

  const contextValue = useMemo(() => ({
    user,
    loading,
    login,
    signup,
    logout,
    forgotPassword,
    updateProfileName,
    changePassword,
  }), [user, loading, login, signup, logout, forgotPassword, updateProfileName, changePassword]);

  return (
    <AuthContext.Provider value={contextValue}>
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
