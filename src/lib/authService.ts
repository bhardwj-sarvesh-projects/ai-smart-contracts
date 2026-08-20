import { supabase, isSupabaseConfigured } from './supabase';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
  photoURL: string;
  preferences: Record<string, any>;
  aiSettings: Record<string, any>;
  securityQuestion?: string;
  securityAnswerHash?: string;
}

function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs = 8000, errMsg = 'Operation timed out'): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errMsg)), timeoutMs)),
  ]);
}

// Client-side SHA-256 helper for security answer hashing
async function hashAnswer(answer: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(answer.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const mapAuthError = (err: any): string => {
  const message = String(err?.message || err || '').toLowerCase();
  if (message.includes('invalid login credentials') || message.includes('invalid_credentials') || message.includes('wrong-password')) {
    return 'Invalid email or password.';
  }
  if (message.includes('user already registered') || message.includes('already exists')) {
    return 'This email is already registered. Please sign in instead.';
  }
  if (message.includes('user not found')) {
    return 'User not found.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many login attempts. Please try again later.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection.';
  }
  return err?.message || 'An unexpected authentication error occurred.';
};

function getCachedProfileByUid(uid: string): UserProfile | null {
  try {
    const direct = localStorage.getItem(`user_profile_${uid}`);
    if (direct) return JSON.parse(direct) as UserProfile;
  } catch {}

  try {
    const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
    return offlineDb[uid] || null;
  } catch {
    return null;
  }
}

function getCachedProfileByEmail(email: string): UserProfile | null {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const directKeys = Object.keys(localStorage).filter((key) => key.startsWith('user_profile_'));
    for (const key of directKeys) {
      try {
        const profile = JSON.parse(localStorage.getItem(key) || '{}') as UserProfile;
        if (String(profile.email || '').toLowerCase() === cleanEmail) return profile;
      } catch {}
    }

    const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
    const found = Object.values(offlineDb).find((profile: any) => String(profile?.email || '').toLowerCase() === cleanEmail);
    return (found as UserProfile | undefined) || null;
  } catch {
    return null;
  }
}

export const AuthService = {
  /**
   * Log in user with email and password using Supabase Auth
   */
  async login(email: string, password: string): Promise<UserProfile> {
    if (!isSupabaseConfigured) {
      console.warn('[OFFLINE_MODE] Logging in locally (no Supabase config).');
      const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
      const found = Object.values(offlineDb).find((u: any) => u.email === email) as UserProfile | undefined;

      if (!found) {
        throw new Error('User not found. Since you are in local offline mode, please sign up to create a local profile.');
      }

      const profile: UserProfile = {
        ...found,
        lastLogin: new Date().toISOString(),
      };
      localStorage.setItem('offline_user', JSON.stringify(profile));
      return profile;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      const user = data.user;
      if (!user) {
        throw new Error('Authentication failed: No user returned');
      }

      // Fetch or initialize profile from Supabase 'profiles' table
      let profileData: UserProfile;
      try {
        const { data: dbProfile, error: profileErr } = await withTimeout(
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          4000,
          'Supabase profiles read timed out'
        );

        if (profileErr || !dbProfile) {
          const isOwner = email.trim().toLowerCase() === 'sarveshtiwarisarvesh@gmail.com';
          const defaultProfile: UserProfile = {
            uid: user.id,
            fullName: user.user_metadata?.full_name || email.split('@')[0] || 'User',
            email: user.email || email,
            role: isOwner ? 'admin' : 'user',
            isActive: true,
            createdAt: user.created_at || new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            photoURL: user.user_metadata?.avatar_url || '',
            preferences: {},
            aiSettings: {},
          };

          // Upsert in background
          supabase.from('profiles').upsert({
            id: user.id,
            email: defaultProfile.email,
            full_name: defaultProfile.fullName,
            role: defaultProfile.role,
            is_active: defaultProfile.isActive,
            photo_url: defaultProfile.photoURL,
            last_login: defaultProfile.lastLogin,
          }).then();

          profileData = defaultProfile;
        } else {
          profileData = {
            uid: dbProfile.id,
            fullName: dbProfile.full_name || user.user_metadata?.full_name || email.split('@')[0] || 'User',
            email: dbProfile.email || user.email || email,
            role: dbProfile.role || (email.trim().toLowerCase() === 'sarveshtiwarisarvesh@gmail.com' ? 'admin' : 'user'),
            isActive: dbProfile.is_active !== false,
            createdAt: dbProfile.created_at || new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            photoURL: dbProfile.photo_url || '',
            preferences: dbProfile.preferences || {},
            aiSettings: dbProfile.ai_settings || {},
            securityQuestion: dbProfile.security_question,
            securityAnswerHash: dbProfile.security_answer_hash,
          };

          // Update last_login in background
          supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', user.id).then();
        }
      } catch (profileFetchErr) {
        console.warn('[AUTH] Could not fetch remote profile, falling back to cache:', profileFetchErr);
        const cached = getCachedProfileByUid(user.id);
        profileData = cached || {
          uid: user.id,
          fullName: user.user_metadata?.full_name || email.split('@')[0] || 'User',
          email: user.email || email,
          role: email.trim().toLowerCase() === 'sarveshtiwarisarvesh@gmail.com' ? 'admin' : 'user',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          photoURL: '',
          preferences: {},
          aiSettings: {},
        };
      }

      if (profileData.isActive === false) {
        await supabase.auth.signOut();
        throw new Error('Account disabled.');
      }

      // Cache profile locally
      localStorage.setItem(`user_profile_${user.id}`, JSON.stringify(profileData));
      return profileData;
    } catch (err: any) {
      if (err.message === 'Account disabled.') throw err;
      throw new Error(mapAuthError(err));
    }
  },

  /**
   * Sign up a new user with email, password, full name, and security question
   */
  async signup(
    email: string,
    password: string,
    fullName: string,
    securityQuestion: string,
    securityAnswer: string
  ): Promise<UserProfile> {
    const isOwner = email.trim().toLowerCase() === 'sarveshtiwarisarvesh@gmail.com';
    const role = isOwner ? 'admin' : 'user';
    const securityAnswerHash = await hashAnswer(securityAnswer);

    if (!isSupabaseConfigured) {
      console.warn('[OFFLINE_MODE] Signing up user locally.');
      const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
      const exists = Object.values(offlineDb).some((u: any) => u.email === email);
      if (exists) {
        throw new Error('This email is already registered locally.');
      }
      const uid = 'offline_' + Math.random().toString(36).substring(2, 11);
      const userProfile: UserProfile = {
        uid,
        fullName,
        email,
        role,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        photoURL: '',
        preferences: {},
        aiSettings: {},
        securityQuestion,
        securityAnswerHash,
      };
      offlineDb[uid] = userProfile;
      localStorage.setItem('offline_users_db', JSON.stringify(offlineDb));
      localStorage.setItem('offline_user', JSON.stringify(userProfile));
      return userProfile;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      const user = data.user;
      if (!user) {
        throw new Error('Sign up completed but no user returned.');
      }

      const userProfile: UserProfile = {
        uid: user.id,
        fullName,
        email: user.email || email,
        role,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        photoURL: '',
        preferences: {},
        aiSettings: {},
        securityQuestion,
        securityAnswerHash,
      };

      // Save profile to Supabase 'profiles' table
      try {
        await withTimeout(
          supabase.from('profiles').upsert({
            id: user.id,
            email: userProfile.email,
            full_name: fullName,
            role,
            is_active: true,
            security_question: securityQuestion,
            security_answer_hash: securityAnswerHash,
            created_at: userProfile.createdAt,
            last_login: userProfile.lastLogin,
          }),
          5000,
          'Supabase profile creation timed out'
        );
      } catch (upsertErr) {
        console.warn('[AUTH] Profile table insert failed during signup:', upsertErr);
      }

      // Cache profile locally
      localStorage.setItem(`user_profile_${user.id}`, JSON.stringify(userProfile));
      return userProfile;
    } catch (err: any) {
      throw new Error(mapAuthError(err));
    }
  },

  /**
   * Send password reset email
   */
  async forgotPassword(email: string): Promise<void> {
    if (!isSupabaseConfigured) {
      console.warn('[OFFLINE_MODE] Password reset simulation');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
    } catch (err: any) {
      throw new Error(mapAuthError(err));
    }
  },

  /**
   * Log out current user
   */
  async logout(): Promise<void> {
    localStorage.removeItem('offline_user');
    localStorage.removeItem('session_user');
    if (!isSupabaseConfigured) {
      return;
    }
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AUTH] Supabase signOut error:', err);
    }
  },

  /**
   * Load a user profile from Supabase by UID
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured) {
      return getCachedProfileByUid(uid);
    }
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        3500,
        'Profile fetch timed out'
      );

      if (error || !data) {
        return getCachedProfileByUid(uid);
      }

      const profile: UserProfile = {
        uid: data.id,
        fullName: data.full_name || 'User',
        email: data.email || '',
        role: data.role || 'user',
        isActive: data.is_active !== false,
        createdAt: data.created_at || new Date().toISOString(),
        lastLogin: data.last_login || new Date().toISOString(),
        photoURL: data.photo_url || '',
        preferences: data.preferences || {},
        aiSettings: data.ai_settings || {},
        securityQuestion: data.security_question,
        securityAnswerHash: data.security_answer_hash,
      };

      localStorage.setItem(`user_profile_${uid}`, JSON.stringify(profile));
      return profile;
    } catch (err) {
      return getCachedProfileByUid(uid);
    }
  },

  /**
   * Get the security question for a given email
   */
  async getSecurityQuestion(email: string): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();

    if (!isSupabaseConfigured) {
      const found = getCachedProfileByEmail(cleanEmail);
      if (!found) throw new Error('User account not found.');
      if (!found.securityQuestion) throw new Error('This account does not have a security question configured.');
      return found.securityQuestion;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('security_question')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error || !data) {
        const found = getCachedProfileByEmail(cleanEmail);
        if (found?.securityQuestion) return found.securityQuestion;
        throw new Error('User account not found.');
      }

      if (!data.security_question) {
        throw new Error('This account does not have a security question configured.');
      }
      return data.security_question;
    } catch (err: any) {
      const found = getCachedProfileByEmail(cleanEmail);
      if (found?.securityQuestion) return found.securityQuestion;
      throw new Error(err.message || 'Failed to retrieve security question.');
    }
  },

  /**
   * Verify the security answer for a given email
   */
  async verifySecurityAnswer(email: string, answer: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const inputHash = await hashAnswer(answer);

    if (!isSupabaseConfigured) {
      const found = getCachedProfileByEmail(cleanEmail);
      if (!found) throw new Error('User account not found.');
      if (found.securityAnswerHash === inputHash) return true;
      throw new Error('Incorrect answer to the security question.');
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('security_answer_hash')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error || !data) {
        const found = getCachedProfileByEmail(cleanEmail);
        if (found && found.securityAnswerHash === inputHash) return true;
        throw new Error('User account not found.');
      }

      if (data.security_answer_hash === inputHash) {
        return true;
      }
      throw new Error('Incorrect answer to the security question.');
    } catch (err: any) {
      if (err.message?.includes('Incorrect answer')) throw err;
      const found = getCachedProfileByEmail(cleanEmail);
      if (found && found.securityAnswerHash === inputHash) return true;
      throw new Error(err.message || 'Failed to verify security answer.');
    }
  },

  /**
   * Update full name in user profile
   */
  async updateProfileName(uid: string, newFullName: string): Promise<UserProfile> {
    const trimmed = (newFullName || '').trim();
    if (!trimmed) {
      throw new Error('Name cannot be empty.');
    }

    if (!isSupabaseConfigured) {
      const offlineDb = JSON.parse(localStorage.getItem('offline_users_db') || '{}');
      const currentOffline = JSON.parse(localStorage.getItem('offline_user') || '{}');
      const updatedUser = { ...currentOffline, fullName: trimmed };
      localStorage.setItem('offline_user', JSON.stringify(updatedUser));
      if (offlineDb[uid]) {
        offlineDb[uid].fullName = trimmed;
        localStorage.setItem('offline_users_db', JSON.stringify(offlineDb));
      }
      return updatedUser;
    }

    try {
      await withTimeout(
        supabase.from('profiles').update({ full_name: trimmed, updated_at: new Date().toISOString() }).eq('id', uid),
        6000,
        'Failed to update profile in database due to a timeout.'
      );

      await supabase.auth.updateUser({
        data: { full_name: trimmed },
      });

      const updated = await this.getUserProfile(uid);
      if (updated) {
        localStorage.setItem(`user_profile_${uid}`, JSON.stringify(updated));
        return updated;
      }
      throw new Error('Profile update failed.');
    } catch (err: any) {
      const cached = getCachedProfileByUid(uid);
      if (cached) {
        cached.fullName = trimmed;
        localStorage.setItem(`user_profile_${uid}`, JSON.stringify(cached));
        return cached;
      }
      throw new Error(err.message || 'Failed to update display name.');
    }
  },

  /**
   * Change password for the current authenticated user
   */
  async changePassword(password: string): Promise<void> {
    const trimmed = (password || '').trim();
    if (trimmed.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    if (!isSupabaseConfigured) {
      return;
    }

    try {
      const { error } = await withTimeout(
        supabase.auth.updateUser({ password: trimmed }),
        8000,
        'Password change timed out'
      );
      if (error) throw error;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update password.');
    }
  },
};
