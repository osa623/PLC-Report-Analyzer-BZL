import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ShieldAlert, Loader2, Sparkles, ArrowLeft, KeyRound, CheckCircle2, X } from "lucide-react";
import { loginUser, forgotPassword} from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth-store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — FDI" },
      { name: "description", content: "Sign in to continue to your account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Forgot password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotShowNewPassword, setForgotShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [devCode, setDevCode] = useState("");
  
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const response = await loginUser({ email, password });
      login(response.user, response.token);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password handlers ──

  const openForgotModal = () => {
    setForgotOpen(true);
    setForgotStep(1);
    setForgotEmail(email); // pre-fill from login form if available
    setForgotCode("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotError("");
    setForgotSuccess("");
    setDevCode("");
  };

  const closeForgotModal = () => {
    setForgotOpen(false);
    setForgotError("");
    setForgotSuccess("");
  };

  const handleForgotSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError("Please enter your email address.");
      return;
    }

    setForgotLoading(true);
    setForgotError("");
    setForgotSuccess("");

    try {
      const response = await forgotPassword(forgotEmail);
      // In dev mode the server returns the code in the response for convenience
      if (response.code) {
        setDevCode(response.code);
      }
      setForgotSuccess(response.message || "Verification code sent to your email.");
      setForgotStep(2);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCode || !forgotNewPassword || !forgotConfirmPassword) {
      setForgotError("All fields are required.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    if (forgotNewPassword.length < 8) {
      setForgotError("Password must be at least 8 characters long.");
      return;
    }

    setForgotLoading(true);
    setForgotError("");

    try {
      const response = await resetPassword({
        email: forgotEmail,
        code: forgotCode,
        newPassword: forgotNewPassword,
      });
      setForgotSuccess(response.message || "Password has been successfully reset!");
      setForgotError("");
      // Auto-close after a brief pause so user sees the success message
      setTimeout(() => {
        closeForgotModal();
      }, 2500);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface)] px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
      >
        {/* Brand/Logo Section */}
        <div className="flex flex-col items-center justify-center">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B1F3A] text-[14px] font-bold tracking-tight text-white shadow-md">
              FDI
            </span>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-[#0B1F3A]">
            Welcome back
          </h2>
          <p className="mt-2 text-center text-[13px] text-gray-500">
            Sign in to continue to your account
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/50 p-4 text-xs font-semibold text-red-600"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSignIn}>
          <div className="space-y-4">
            {/* Email Field */}
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
                  className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgotModal}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Lock className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-11 py-3 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
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
                "Sign in"
              )}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3.5 text-gray-400 font-medium">or continue with</span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button className="flex justify-center items-center py-2.5 px-4 border border-gray-100 rounded-2xl bg-white hover:bg-slate-50 transition-colors">
            {/* Google Icon */}
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
          </button>
          <button className="flex justify-center items-center py-2.5 px-4 border border-gray-100 rounded-2xl bg-white hover:bg-slate-50 transition-colors">
            {/* Microsoft Icon */}
            <svg className="h-5 w-5" viewBox="0 0 23 23" fill="currentColor">
              <rect x="0" y="0" width="11" height="11" fill="#F25022"/>
              <rect x="12" y="0" width="11" height="11" fill="#7FBA00"/>
              <rect x="0" y="12" width="11" height="11" fill="#00A4EF"/>
              <rect x="12" y="12" width="11" height="11" fill="#FFB900"/>
            </svg>
          </button>
          <button className="flex justify-center items-center py-2.5 px-4 border border-gray-100 rounded-2xl bg-white hover:bg-slate-50 transition-colors">
            {/* Passkey Mock Icon (Fingerprint-like) */}
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 009 11a5 5 0 00-10 0c0 1.017.07 2.019.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
          </button>
        </div>

        {/* Security Banner */}
        <div className="flex items-center gap-3.5 bg-blue-50/40 border border-blue-100 rounded-2xl p-4 mt-6">
          <div className="bg-blue-600 text-white rounded-xl p-2 shrink-0">
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h4 className="text-[12.5px] font-bold text-blue-900 leading-tight">Your data is secure with us</h4>
            <p className="text-[10px] text-blue-800/70 mt-0.5 leading-normal">
              We use industry-standard encryption and security practices to protect your information.
            </p>
          </div>
        </div>

        {/* Footer Link */}
        <div className="text-center text-xs mt-6 text-gray-500 font-medium">
          Don't have an account?{" "}
          <Link to="/register" className="font-bold text-blue-600 hover:text-blue-700 transition-colors">
            Create account
          </Link>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════════════════
          FORGOT PASSWORD MODAL OVERLAY
         ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={closeForgotModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full max-w-md bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_20px_60px_rgba(15,23,42,0.15)] relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={closeForgotModal}
                className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="flex flex-col items-center mb-6">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/20 mb-4">
                  <KeyRound className="h-5.5 w-5.5" strokeWidth={2} />
                </div>
                <h3 className="text-xl font-extrabold tracking-tight text-[#0B1F3A]">
                  {forgotStep === 1 ? "Reset Password" : "Enter Verification Code"}
                </h3>
                <p className="mt-1.5 text-center text-[12.5px] text-gray-500 max-w-xs leading-relaxed">
                  {forgotStep === 1
                    ? "Enter your email address and we'll send you a 6-digit verification code."
                    : `We sent a code to ${forgotEmail}. Enter it below with your new password.`}
                </p>
              </div>

              {/* Error display */}
              <AnimatePresence mode="wait">
                {forgotError && (
                  <motion.div
                    key="forgot-error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50/50 p-3.5 text-xs font-semibold text-red-600">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{forgotError}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success display */}
              <AnimatePresence mode="wait">
                {forgotSuccess && forgotStep === 2 && !forgotError && (
                  <motion.div
                    key="forgot-success"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="flex items-start gap-2.5 rounded-2xl border border-green-100 bg-green-50/50 p-3.5 text-xs font-semibold text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{forgotSuccess}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 1: Email input */}
              <AnimatePresence mode="wait">
                {forgotStep === 1 && (
                  <motion.form
                    key="step-1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleForgotSubmitEmail}
                    className="space-y-5"
                  >
                    <div>
                      <label htmlFor="forgot-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                        Email address
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                          <Mail className="h-4.5 w-4.5" strokeWidth={1.75} />
                        </span>
                        <input
                          id="forgot-email"
                          type="email"
                          required
                          placeholder="Enter your registered email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex w-full justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-2xl text-[14px] font-bold text-white bg-[#0B1F3A] hover:bg-[#071426] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors shadow-md"
                    >
                      {forgotLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Send Verification Code
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={closeForgotModal}
                      className="flex w-full justify-center items-center gap-1.5 py-2.5 text-[12.5px] font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to sign in
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Step 2: Code + New password */}
              <AnimatePresence mode="wait">
                {forgotStep === 2 && (
                  <motion.form
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleResetPassword}
                    className="space-y-4"
                  >
                    {/* Dev helper: show the code if returned */}
                    {devCode && (
                      <div className="flex items-center gap-2.5 rounded-2xl border border-amber-100 bg-amber-50/50 p-3.5 text-[11px] font-semibold text-amber-800">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span>Dev mode — Your code is: <span className="font-mono font-black text-[13px] tracking-widest text-amber-900">{devCode}</span></span>
                      </div>
                    )}

                    {/* 6-digit code input */}
                    <div>
                      <label htmlFor="forgot-code" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                        Verification Code
                      </label>
                      <input
                        id="forgot-code"
                        type="text"
                        required
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={forgotCode}
                        onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="block w-full px-4 py-3 border border-gray-200 rounded-2xl text-center text-[22px] font-mono font-black tracking-[0.5em] placeholder-gray-300 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                      />
                    </div>

                    {/* New password */}
                    <div>
                      <label htmlFor="forgot-new-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                        New Password
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                          <Lock className="h-4.5 w-4.5" strokeWidth={1.75} />
                        </span>
                        <input
                          id="forgot-new-password"
                          type={forgotShowNewPassword ? "text" : "password"}
                          required
                          placeholder="Min 8 chars, letters & numbers"
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          className="block w-full pl-11 pr-11 py-3 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setForgotShowNewPassword(!forgotShowNewPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
                        >
                          {forgotShowNewPassword ? (
                            <EyeOff className="h-4.5 w-4.5" strokeWidth={1.75} />
                          ) : (
                            <Eye className="h-4.5 w-4.5" strokeWidth={1.75} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label htmlFor="forgot-confirm-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                          <Lock className="h-4.5 w-4.5" strokeWidth={1.75} />
                        </span>
                        <input
                          id="forgot-confirm-password"
                          type={forgotShowNewPassword ? "text" : "password"}
                          required
                          placeholder="Repeat your new password"
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-[14.5px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                        />
                      </div>
                      {/* Password match indicator */}
                      {forgotConfirmPassword && (
                        <div className={`mt-1.5 ml-1 text-[10.5px] font-semibold flex items-center gap-1 ${
                          forgotNewPassword === forgotConfirmPassword ? "text-green-600" : "text-red-500"
                        }`}>
                          {forgotNewPassword === forgotConfirmPassword ? (
                            <><CheckCircle2 className="h-3 w-3" /> Passwords match</>
                          ) : (
                            <><ShieldAlert className="h-3 w-3" /> Passwords do not match</>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading || forgotCode.length !== 6}
                      className="flex w-full justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-2xl text-[14px] font-bold text-white bg-[#0B1F3A] hover:bg-[#071426] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors shadow-md mt-2"
                    >
                      {forgotLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Reset Password"
                      )}
                    </button>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => { setForgotStep(1); setForgotError(""); setForgotSuccess(""); }}
                        className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        Change email
                      </button>
                      <button
                        type="button"
                        onClick={handleForgotSubmitEmail}
                        disabled={forgotLoading}
                        className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
