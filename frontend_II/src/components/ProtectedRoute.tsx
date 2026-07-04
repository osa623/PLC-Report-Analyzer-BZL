/**
 * Protected Route Component
 * 
 * Wraps pages that require authentication. Redirects unauthenticated users
 * to login, and authenticated users who haven't completed registration to
 * the registration page.
 * 
 * Usage:
 * <ProtectedRoute>
 *   <YourProtectedPage />
 * </ProtectedRoute>
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRegistration?: boolean;
}

export default function ProtectedRoute({ children, requireRegistration = true }: ProtectedRouteProps) {
  const { firebaseUser, backendUser, loading, needsRegistration } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Not authenticated at all -> redirect to login
      if (!firebaseUser) {
        router.push('/welcome-page/login-page');
        return;
      }

      // Authenticated but not registered in backend -> redirect to registration
      if (requireRegistration && needsRegistration) {
        router.push('/welcome-page/register-page');
        return;
      }
    }
  }, [firebaseUser, backendUser, loading, needsRegistration, requireRegistration, router]);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#926F34] border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated or needs registration, don't render children
  // (redirect will happen via useEffect)
  if (!firebaseUser || (requireRegistration && needsRegistration)) {
    return null;
  }

  // User is authenticated and registered (or registration not required)
  return <>{children}</>;
}
