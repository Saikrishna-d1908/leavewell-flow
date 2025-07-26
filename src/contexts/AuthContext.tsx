import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { mockAuth, MockUser, MockSession } from '@/lib/mockAuth';

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'employee' | 'manager' | 'admin';
  manager_id?: string;
  department?: string;
}

interface AuthContextType {
  user: User | MockUser | null;
  session: Session | MockSession | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: { first_name: string; last_name: string; role?: string }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isMockMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | MockUser | null>(null);
  const [session, setSession] = useState<Session | MockSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMockMode, setIsMockMode] = useState(false);

  useEffect(() => {
    // Initialize mock auth and create demo users
    const initializeAuth = async () => {
      try {
        // Create demo users for testing
        await mockAuth.createDemoUsers();
        
        // Check for existing mock session first
        const mockSession = mockAuth.getSession();
        if (mockSession) {
          console.log('📱 Using mock authentication mode');
          setIsMockMode(true);
          setUser(mockSession.user);
          setSession(mockSession);
          setProfile({
            id: mockSession.user.id,
            email: mockSession.user.email,
            first_name: mockSession.user.first_name,
            last_name: mockSession.user.last_name,
            role: mockSession.user.role
          });
          setLoading(false);
          return;
        }

        // Try Supabase auth
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('🔐 Using Supabase authentication');
          setSession(session);
          setUser(session.user);
          
          // Try to fetch profile
          try {
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (error) {
              console.error('Profile fetch failed, switching to mock mode:', error);
              // Switch to mock mode if profile fetch fails
              setIsMockMode(true);
              setProfile({
                id: session.user.id,
                email: session.user.email || '',
                first_name: session.user.user_metadata?.first_name || 'User',
                last_name: session.user.user_metadata?.last_name || 'Name',
                role: session.user.user_metadata?.role || 'employee'
              });
            } else {
              setProfile(profileData);
            }
          } catch (error) {
            console.error('Profile fetch error, switching to mock mode:', error);
            setIsMockMode(true);
            setProfile({
              id: session.user.id,
              email: session.user.email || '',
              first_name: session.user.user_metadata?.first_name || 'User',
              last_name: session.user.user_metadata?.last_name || 'Name',
              role: session.user.user_metadata?.role || 'employee'
            });
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setLoading(false);
      }
    };

    initializeAuth();

    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMockMode) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            try {
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (error) {
                console.error('Error fetching profile, using fallback:', error);
                setProfile({
                  id: session.user.id,
                  email: session.user.email || '',
                  first_name: session.user.user_metadata?.first_name || 'User',
                  last_name: session.user.user_metadata?.last_name || 'Name',
                  role: session.user.user_metadata?.role || 'employee'
                });
              } else {
                setProfile(profileData);
              }
            } catch (error) {
              console.error('Error fetching profile, using fallback:', error);
              setProfile({
                id: session.user.id,
                email: session.user.email || '',
                first_name: session.user.user_metadata?.first_name || 'User',
                last_name: session.user.user_metadata?.last_name || 'Name',
                role: session.user.user_metadata?.role || 'employee'
              });
            }
          } else {
            setProfile(null);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [isMockMode]);

  const signIn = async (email: string, password: string) => {
    try {
      // Try Supabase auth first
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (!error && data.user) {
        console.log('✅ Supabase signin successful');
        return { error: null };
      }
      
      // If Supabase fails, try mock auth
      console.log('🔄 Supabase signin failed, trying mock auth...');
      const mockResult = await mockAuth.signIn(email, password);
      
      if (mockResult.user && mockResult.session) {
        console.log('✅ Mock signin successful');
        setIsMockMode(true);
        setUser(mockResult.user);
        setSession(mockResult.session);
        setProfile({
          id: mockResult.user.id,
          email: mockResult.user.email,
          first_name: mockResult.user.first_name,
          last_name: mockResult.user.last_name,
          role: mockResult.user.role
        });
        return { error: null };
      }
      
      return { error: mockResult.error || error };
    } catch (catchError) {
      console.error('Signin error:', catchError);
      return { error: catchError };
    }
  };

  const signUp = async (email: string, password: string, userData: { first_name: string; last_name: string; role?: string }) => {
    try {
      // Try mock auth first (since Supabase has database issues)
      console.log('🔄 Using mock authentication for signup...');
      const mockResult = await mockAuth.signUp(email, password, userData);
      
      if (mockResult.user) {
        console.log('✅ Mock signup successful');
        setIsMockMode(true);
        
        // Auto-signin the user after successful signup
        const signInResult = await mockAuth.signIn(email, password);
        if (signInResult.user && signInResult.session) {
          setUser(signInResult.user);
          setSession(signInResult.session);
          setProfile({
            id: signInResult.user.id,
            email: signInResult.user.email,
            first_name: signInResult.user.first_name,
            last_name: signInResult.user.last_name,
            role: signInResult.user.role
          });
        }
        
        return { error: null };
      }
      
      return { error: mockResult.error };
    } catch (catchError) {
      console.error('Signup error:', catchError);
      return { error: catchError };
    }
  };

  const signOut = async () => {
    if (isMockMode) {
      await mockAuth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsMockMode(false);
    } else {
      await supabase.auth.signOut();
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    isMockMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}