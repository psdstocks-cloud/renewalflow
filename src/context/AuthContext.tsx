import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

type SignInPayload = { email: string; password: string };
type SignUpPayload = { email: string; password: string };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (payload: SignInPayload) => Promise<Session | null>;
  signUp: (payload: SignUpPayload) => Promise<{ user: User | null; session: Session | null; confirmationEmailSent: boolean }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const signIn = async ({ email, password }: SignInPayload) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    setSession(data.session);
    setUser(data.session?.user ?? null);
    return data.session;
  };

  const signUp = async ({ email, password }: SignUpPayload) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      throw error;
    }
    setSession(data.session);
    setUser(data.user ?? null);
    return { user: data.user ?? null, session: data.session ?? null, confirmationEmailSent: !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  const refreshSession = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session ?? null);
    setUser(data.session?.user ?? null);
  };

  const value = useMemo(
    () => ({ user, session, loading, signIn, signUp, signOut, refreshSession }),
    [user, session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
