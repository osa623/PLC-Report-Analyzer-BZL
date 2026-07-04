/**
 * Authentication Context and Provider
 * 
 * Manages the application's authentication state, combining Firebase Auth
 * and backend user profile data. Provides hooks for sign up, sign in, sign out,
 * and profile management.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getMe, registerUser } from '@/lib/api';
import { UserMeResponse, RegisterUserRequest } from '@/lib/types';

interface AuthContextType {
  // State
  firebaseUser: FirebaseUser | null;
  backendUser: UserMeResponse | null;
  loading: boolean;
  needsRegistration: boolean;
  registrationInProgress: boolean;
  
  // Actions
  signUp: (email: string, password: string) => Promise<FirebaseUser>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  registerBackendUser: (data: RegisterUserRequest) => Promise<UserMeResponse>;
  refreshProfile: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  checkEmailVerified: () => Promise<boolean>;
  setRegistrationComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [backendUser, setBackendUser] = useState<UserMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [registrationInProgress, setRegistrationInProgress] = useState(false);

  // Load user profile from backend
  const loadBackendProfile = async (user: FirebaseUser) => {
    try {
      const profile = await getMe();
      setBackendUser(profile);
      setNeedsRegistration(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // 404 means user exists in Firebase but hasn't registered in backend
      if (error.message.includes('404') || error.message.includes('not found')) {
        setNeedsRegistration(true);
        setBackendUser(null);
      } else {
        console.error('Error loading backend profile:', error);
        setBackendUser(null);
      }
    }
  };

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        // User is signed in, load their backend profile
        await loadBackendProfile(user);
      } else {
        // User is signed out
        setBackendUser(null);
        setNeedsRegistration(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Sign up a new user with Firebase
   * Note: This only creates the Firebase account. The registration form
   * should call registerBackendUser() with the remaining profile data.
   */
  const signUp = async (email: string, password: string): Promise<FirebaseUser> => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    setNeedsRegistration(true);
    setRegistrationInProgress(true);
    return result.user;
  };

  /**
   * Sign in an existing user
   * Automatically loads the backend profile after successful sign in
   */
  const signIn = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await loadBackendProfile(result.user);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign out the current user
   * Clears all auth state
   */
  const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setBackendUser(null);
    setNeedsRegistration(false);
  };

  /**
   * Register the user in the backend database
   * Should be called after Firebase sign up is complete
   */
  const registerBackendUser = async (data: RegisterUserRequest): Promise<UserMeResponse> => {
    // Use auth.currentUser instead of firebaseUser state — state updates
    // asynchronously via onAuthStateChanged and may not be set yet right after signUp
    const currentUser = auth?.currentUser || firebaseUser;
    if (!currentUser) {
      throw new Error('No Firebase user found. Sign up first.');
    }

    const profile = await registerUser(data);
    // Don't set backendUser or clear needsRegistration yet —
    // the multi-step registration flow is still in progress.
    // These will be set when setRegistrationComplete() is called
    // at the end of the full registration flow.
    return profile;
  };

  /**
   * Refresh the current user's profile from the backend
   */
  const refreshProfile = async (): Promise<void> => {
    const currentUser = auth?.currentUser || firebaseUser;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }
    await loadBackendProfile(currentUser);
  };

  /**
   * Send email verification to the current Firebase user
   * Uses actionCodeSettings so Firebase knows where to redirect after verification
   */
  const sendVerificationEmail = async (): Promise<void> => {
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user to verify');
    }

    const actionCodeSettings = {
      url: typeof window !== 'undefined'
        ? `${window.location.origin}/welcome-page/register-page`
        : 'http://localhost:3000/welcome-page/register-page',
      handleCodeInApp: false,
    };

    await sendEmailVerification(currentUser, actionCodeSettings);
  };

  /**
   * Check if the current user's email is verified
   * Forces a reload + token refresh to get the latest emailVerified status
   */
  const checkEmailVerified = async (): Promise<boolean> => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return false;
    await currentUser.reload();
    // Force a fresh token so claims are up-to-date
    await currentUser.getIdToken(true);
    return currentUser.emailVerified;
  };

  /**
   * Mark the multi-step registration as complete
   * This loads the full profile and makes user info visible in the Header
   */
  const setRegistrationComplete = () => {
    setRegistrationInProgress(false);
    setNeedsRegistration(false);
    // Load the full profile now that registration is done
    const currentUser = auth?.currentUser;
    if (currentUser) {
      loadBackendProfile(currentUser);
    }
  };

  const value: AuthContextType = {
    firebaseUser,
    backendUser,
    loading,
    needsRegistration,
    registrationInProgress,
    signUp,
    signIn,
    signOut,
    registerBackendUser,
    refreshProfile,
    sendVerificationEmail,
    checkEmailVerified,
    setRegistrationComplete,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
