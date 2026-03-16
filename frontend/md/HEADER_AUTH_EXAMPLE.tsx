/**
 * EXAMPLE: How to Add Sign Out to Your Header
 * 
 * This is a reference example showing how to integrate authentication
 * into your Header component. You can adapt this to your existing Header.
 * 
 * File location: src/components/Common/Header.tsx
 */

"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HeaderExample() {
  const { firebaseUser, backendUser, signOut, loading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <header className="header-class">
      {/* Your existing header content */}
      
      {/* Add this auth section to your header */}
      <div className="auth-section">
        {loading ? (
          <div>...</div>
        ) : firebaseUser ? (
          // User is logged in
          <>
            <span className="text-white">
              {backendUser?.first_name || firebaseUser.email}
            </span>
            <Link href="/profile" className="text-[#DFBD69] hover:underline">
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="text-zinc-400 hover:text-white"
            >
              Sign Out
            </button>
          </>
        ) : (
          // User is not logged in
          <>
            <Link
              href="/welcome-page/login-page"
              className="text-[#DFBD69] hover:underline"
            >
              Sign In
            </Link>
            <Link
              href="/welcome-page/register-page"
              className="bg-[#926F34] text-white px-4 py-2 rounded"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
