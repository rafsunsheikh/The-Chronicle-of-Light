import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import type { Profile } from '../types/contribution';

interface AuthContextValue {
  /** Whether Supabase is configured at all (env vars present). */
  enabled: boolean;
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  isMaintainer: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    // `loading` initialises to isSupabaseConfigured, so when there's no client
    // it's already false — nothing to do (and no synchronous setState here).
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!active) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) loadProfile(u.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) loadProfile(u.id);
        else setProfile(null);
      },
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      enabled: isSupabaseConfigured,
      loading,
      user,
      profile,
      isMaintainer: profile?.role === 'maintainer',
      signInWithGoogle,
      signOut,
    }),
    [loading, user, profile, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
