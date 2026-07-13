import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { User as UserIcon, Mail, Lock, Eye, EyeOff, Building, ArrowLeft, ShieldAlert, Loader2 } from "lucide-react";
import { registerUser } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth-store";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Account — FDI" },
      { name: "description", content: "Create an FDI account to get started." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Client-side validations
    if (!fullName || !email || !organization || !password || !confirmPassword) {
      setError("Please fill out all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agreeTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must be at least 8 characters long and contain both letters and numbers.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await registerUser({
        name: fullName,
        email,
        organization,
        password,
      });

      login(response.user, response.token);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface)] px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_4px_24px_rgba(15,23,42,0.04)] relative"
      >
        {/* Back Button */}
        <Link 
          to="/" 
          className="absolute top-6 left-6 flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
          <span>Back</span>
        </Link>

        {/* Brand/Logo Section */}
        <div className="flex flex-col items-center justify-center pt-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B1F3A] text-[14px] font-bold tracking-tight text-white shadow-md">
              FDI
            </span>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-[#0B1F3A]">
            Create your account
          </h2>
          <p className="mt-2 text-center text-[13px] text-gray-500">
            Enter your details to get started
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/50 p-4 text-xs font-semibold text-red-600"
          >
            <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleRegister}>
          <div className="space-y-4">
            {/* Full Name Field */}
            <div className="relative">
              <label htmlFor="fullName" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                Full name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <UserIcon className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                />
              </div>
            </div>

            {/* Email Address Field */}
            <div className="relative">
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                Email address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Mail className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                />
              </div>
            </div>

            {/* Organization Name Field */}
            <div className="relative">
              <label htmlFor="organization" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                Organization name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Building className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <input
                  id="organization"
                  type="text"
                  required
                  placeholder="Enter your organization name"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="relative">
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Lock className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-11 py-2.5 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4.5 w-4.5" strokeWidth={1.75} />
                  ) : (
                    <Eye className="h-4.5 w-4.5" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="relative">
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                Confirm password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Lock className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-11 pr-11 py-2.5 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4.5 w-4.5" strokeWidth={1.75} />
                  ) : (
                    <Eye className="h-4.5 w-4.5" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {/* Agreement Checkbox */}
            <div className="flex items-start gap-2.5 py-1">
              <input
                id="agreeTerms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4.5 w-4.5 border border-gray-200 rounded-md text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="agreeTerms" className="text-xs text-gray-500 leading-normal select-none cursor-pointer">
                I agree to the <a href="#terms" className="font-bold text-blue-600 hover:underline">Terms of Service</a> and <a href="#privacy" className="font-bold text-blue-600 hover:underline">Privacy Policy</a>
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-2xl text-[14px] font-bold text-white bg-[#0B1F3A] hover:bg-[#071426] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors shadow-md"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create account"
              )}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3.5 text-gray-400 font-medium">or sign up with</span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button className="flex justify-center items-center py-2.5 px-4 border border-gray-100 rounded-2xl bg-white hover:bg-slate-50 transition-colors">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
          </button>
          <button className="flex justify-center items-center py-2.5 px-4 border border-gray-100 rounded-2xl bg-white hover:bg-slate-50 transition-colors">
            <svg className="h-5 w-5" viewBox="0 0 23 23" fill="currentColor">
              <rect x="0" y="0" width="11" height="11" fill="#F25022"/>
              <rect x="12" y="0" width="11" height="11" fill="#7FBA00"/>
              <rect x="0" y="12" width="11" height="11" fill="#00A4EF"/>
              <rect x="12" y="12" width="11" height="11" fill="#FFB900"/>
            </svg>
          </button>
          <button className="flex justify-center items-center py-2.5 px-4 border border-gray-100 rounded-2xl bg-white hover:bg-slate-50 transition-colors">
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 009 11a5 5 0 00-10 0c0 1.017.07 2.019.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
          </button>
        </div>

        {/* Footer Link */}
        <div className="text-center text-xs mt-6 text-gray-500 font-medium">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700 transition-colors">
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
