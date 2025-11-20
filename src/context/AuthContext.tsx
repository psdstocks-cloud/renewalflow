import React, {
    createContext,
    useState,
    useContext,
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
  } from 'react';
  import { supabase } from '../lib/supabaseClient';
  import type { Session, User } from '@supabase/supabase-js';
  
  interface AuthContextType {
    user: User | null;
    session: Session | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    signIn: (payload: { email: string; password: string }) => Promise<void>;
    signUp: (payload: { email: string; password: string }) => Promise<void>;
    signOut: () => Promise<void>;
    refreshSession: () => Promise<void>;
  }
  
  const AuthContext = createContext<AuthContextType | undefined>(undefined);
  
  // ---------- global access token for apiClient ----------
  let currentAccessToken: string | null = null;
  export const getAuthToken = () => currentAccessToken;
  
  // ---------- provider ----------
  export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
  
    // Helper to update React state + global token in one place
    const applySession = useCallback((nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      currentAccessToken = nextSession?.access_token ?? null;
    }, []);
  
    // Initial session load + auth state listener
    useEffect(() => {
      let isMounted = true;

      const init = async () => {
        setIsLoading(true);
        
        try {
          const { data, error } = await supabase.auth.getSession();

          if (!isMounted) return;

          if (error) {
            console.error('[Auth] getSession error', error);
            applySession(null);
          } else {
            applySession(data.session ?? null);
          }
        } catch (err) {
          console.error('[Auth] getSession exception', err);
          if (isMounted) {
            applySession(null);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      init();

      const { data: listener } = supabase.auth.onAuthStateChange(
        (event, newSession) => {
          if (!isMounted) return;
          
          console.log('[Auth] State changed:', event, newSession?.user?.email);
          applySession(newSession);
          
          // If session was restored, we're no longer loading
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setIsLoading(false);
          }
        },
      );

      return () => {
        isMounted = false;
        listener?.subscription.unsubscribe();
      };
    }, [applySession]);
  
    const signIn = useCallback(
      async ({ email, password }: { email: string; password: string }) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
  
        if (error) {
          console.error('[Auth] signIn error', error);
          throw error;
        }
  
        // Immediately update session + token before any API calls
        applySession(data.session ?? null);
      },
      [applySession],
    );
  
    const signUp = useCallback(
      async ({ email, password }: { email: string; password: string }) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/email-confirm-info`,
          },
        });
  
        if (error) {
          console.error('[Auth] signUp error', error);
          throw error;
        }
  
        // Some Supabase configs don’t create a session on sign-up; safe anyway:
        applySession(data.session ?? null);
      },
      [applySession],
    );
  
    const signOut = useCallback(async () => {
      const { error } = await supabase.auth.signOut();
  
      if (error) {
        console.error('[Auth] signOut error', error);
        throw error;
      }
  
      applySession(null);
    }, [applySession]);
  
    const refreshSession = useCallback(async () => {
      const { data, error } = await supabase.auth.getSession();
  
      if (error) {
        console.error('[Auth] refreshSession error', error);
        throw error;
      }
  
      applySession(data.session ?? null);
    }, [applySession]);
  
    const value = useMemo(
      () => ({
        user,
        session,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshSession,
      }),
      [user, session, isLoading, signIn, signUp, signOut, refreshSession],
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
  