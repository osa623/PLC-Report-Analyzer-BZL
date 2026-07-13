"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
    Mail, RefreshCw, CheckCircle, Smartphone,
    ArrowRight, ArrowLeft, ShieldCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
    RecaptchaVerifier,
    linkWithPhoneNumber,
} from "firebase/auth";
import type { ConfirmationResult } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Interface
interface PreVerificationProps {
    onComplete: () => void;
    onBack: () => void;
    phone?: string;
}

// Format phone to E.164 for Firebase
function formatPhoneE164(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, "");
    return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export default function PreVerification({ onComplete, onBack, phone }: PreVerificationProps) {
    const [view, setView] = useState<"method" | "email" | "phone">("method");
    const [isVerified, setIsVerified] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailSent, setEmailSent] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [canResend, setCanResend] = useState(true);

    // Phone OTP state
    const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
    const [codeSent, setCodeSent] = useState(false);
    const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);

    const { sendVerificationEmail, checkEmailVerified, firebaseUser } = useAuth();
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

    const userEmail = firebaseUser?.email || "";
    const userPhone = phone || "";
    const hasPhone = userPhone.replace(/[^\d]/g, "").length >= 7;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
            if (recaptchaVerifierRef.current) {
                try { recaptchaVerifierRef.current.clear(); } catch { /* ignore */ }
            }
        };
    }, []);

    // If no phone, auto-select email method
    useEffect(() => {
        if (!hasPhone) {
            selectMethod("email");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poll for email verification every 3s when in email view
    useEffect(() => {
        if (view === "email" && emailSent && !isVerified) {
            pollRef.current = setInterval(async () => {
                try {
                    const verified = await checkEmailVerified();
                    if (verified) {
                        setIsVerified(true);
                        if (pollRef.current) clearInterval(pollRef.current);
                    }
                } catch { /* silently retry */ }
            }, 3000);
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, emailSent, isVerified]);

    // ---- Timer ----
    const startCooldownTimer = () => {
        setCanResend(false);
        setTimeLeft(60);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setCanResend(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // ======== EMAIL METHODS ========
    const handleSendEmail = async () => {
        setError(null);
        setIsLoading(true);
        try {
            await sendVerificationEmail();
            setEmailSent(true);
            startCooldownTimer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Verification email error:", err);
            if (err.code === "auth/too-many-requests") {
                setError("Too many requests. Please wait a moment before trying again.");
            } else {
                setError(err.message || "Failed to send verification email. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendEmail = async () => {
        if (!canResend) return;
        await handleSendEmail();
    };

    const handleCheckEmailManually = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const verified = await checkEmailVerified();
            if (verified) {
                setIsVerified(true);
            } else {
                setError("Email not yet verified. Please check your inbox and click the verification link.");
            }
        } catch {
            setError("Could not verify status. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // ======== PHONE METHODS ========
    const handleSendPhoneCode = async () => {
        setError(null);
        setIsLoading(true);
        try {
            // Cleanup previous reCAPTCHA
            if (recaptchaVerifierRef.current) {
                try { recaptchaVerifierRef.current.clear(); } catch { /* ignore */ }
            }

            // Create invisible reCAPTCHA verifier
            recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
                size: "invisible",
            });

            const formattedPhone = formatPhoneE164(userPhone);
            const currentUser = auth.currentUser;

            if (!currentUser) {
                setError("No authenticated user. Please go back and sign up first.");
                return;
            }

            const result = await linkWithPhoneNumber(currentUser, formattedPhone, recaptchaVerifierRef.current);
            setConfirmResult(result);
            setCodeSent(true);
            startCooldownTimer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Phone code error:", err);
            if (err.code === "auth/operation-not-allowed") {
                setError("Phone verification is not enabled. Please use email verification instead.");
            } else if (err.code === "auth/invalid-phone-number") {
                setError("Invalid phone number format. Please go back and enter a valid phone number with country code (e.g. +94...).");
            } else if (err.code === "auth/too-many-requests") {
                setError("Too many attempts. Please wait before trying again.");
            } else if (err.code === "auth/credential-already-in-use") {
                setError("This phone number is already linked to another account.");
            } else if (err.code === "auth/provider-already-linked") {
                // Phone already verified/linked
                setIsVerified(true);
            } else {
                setError(err.message || "Failed to send verification code. Please try email instead.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendPhoneCode = async () => {
        if (!canResend) return;
        setVerificationCode(["", "", "", "", "", ""]);
        await handleSendPhoneCode();
    };

    const handleVerifyPhoneCode = async () => {
        if (!confirmResult) {
            setError("No verification in progress. Please resend the code.");
            return;
        }

        const code = verificationCode.join("");
        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
            setError("Please enter a valid 6-digit code.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            await confirmResult.confirm(code);
            setIsVerified(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Phone verify error:", err);
            if (err.code === "auth/invalid-verification-code") {
                setError("Invalid verification code. Please check and try again.");
            } else if (err.code === "auth/code-expired") {
                setError("Code has expired. Please request a new one.");
                setCodeSent(false);
                setConfirmResult(null);
            } else {
                setError(err.message || "Verification failed. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ---- Code Input Handlers ----
    const handleCodeChange = (index: number, value: string) => {
        if (value.length > 1) return;
        if (value && !/^\d$/.test(value)) return;
        const newCode = [...verificationCode];
        newCode[index] = value;
        setVerificationCode(newCode);
        if (value && index < 5) {
            const nextInput = document.getElementById(`code-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
            const prevInput = document.getElementById(`code-${index - 1}`);
            if (prevInput) prevInput.focus();
        }
    };

    // ---- Navigation ----
    const selectMethod = (method: "email" | "phone") => {
        setError(null);
        setIsVerified(false);
        if (method === "email") {
            setView("email");
            handleSendEmail();
        } else {
            setView("phone");
        }
    };

    const goBackToMethod = () => {
        setError(null);
        setIsVerified(false);
        setEmailSent(false);
        setCodeSent(false);
        setConfirmResult(null);
        setVerificationCode(["", "", "", "", "", ""]);
        if (pollRef.current) clearInterval(pollRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        setView("method");
    };

    const handleContinue = () => {
        if (isVerified) onComplete();
    };

    return (
        <div className="w-full max-w-lg p-10 rounded-3xl bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039]/90 backdrop-blur-2xl border border-white/5 shadow-2xl relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#926F34]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[#DFBD69]/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Invisible reCAPTCHA container for phone auth */}
            <div id="recaptcha-container"></div>

            <div className="relative z-10 text-center">

                {/* =============== METHOD SELECTION =============== */}
                {view === "method" && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 mb-6 tracking-tight font-encode">
                            Select Verification Method
                        </h2>
                        <div className="grid grid-cols-1 gap-4">
                            {/* Email option */}
                            <button
                                onClick={() => selectMethod("email")}
                                className="group flex items-center justify-between p-5 rounded-2xl bg-[#0A0E1A]/60 border border-white/5 hover:border-[#DFBD69]/50 transition-all duration-300 hover:bg-[#0A0E1A]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-[#DFBD69]/10 flex items-center justify-center text-[#DFBD69]">
                                        <Mail size={24} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-white font-bold text-sm uppercase tracking-wide">Email Address</h3>
                                        <p className="text-zinc-500 text-xs">Verify via link sent to your email</p>
                                    </div>
                                </div>
                                <ArrowRight className="text-zinc-600 group-hover:text-[#DFBD69] transition-colors" size={20} />
                            </button>

                            {/* Phone option (only if phone was provided) */}
                            {hasPhone && (
                                <button
                                    onClick={() => selectMethod("phone")}
                                    className="group flex items-center justify-between p-5 rounded-2xl bg-[#0A0E1A]/60 border border-white/5 hover:border-[#DFBD69]/50 transition-all duration-300 hover:bg-[#0A0E1A]"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-[#DFBD69]/10 flex items-center justify-center text-[#DFBD69]">
                                            <Smartphone size={24} />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-white font-bold text-sm uppercase tracking-wide">Phone Number</h3>
                                            <p className="text-zinc-500 text-xs">Verify via code sent to your phone</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="text-zinc-600 group-hover:text-[#DFBD69] transition-colors" size={20} />
                                </button>
                            )}

                            {/* Back */}
                            <button
                                onClick={onBack}
                                className="group flex items-center justify-between p-2 rounded-2xl bg-transparent border border-white/5 hover:border-[#DFBD69]/50 transition-all duration-300 hover:bg-[#0A0E1A]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#DFBD69]">
                                        <ArrowLeft className="text-white" size={14} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-white font-bold text-xs uppercase tracking-wide">Back</h3>
                                        <p className="text-zinc-100 text-xs">Go back to previous step</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* =============== EMAIL VERIFICATION =============== */}
                {view === "email" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Icon */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border ${
                                isVerified
                                    ? "bg-emerald-500/10 border-emerald-500/20"
                                    : "bg-[#DFBD69]/10 border-[#DFBD69]/20"
                            }`}
                        >
                            {isVerified ? (
                                <ShieldCheck className="text-emerald-400" size={32} />
                            ) : (
                                <Mail className="text-[#DFBD69]" size={32} />
                            )}
                        </motion.div>

                        {/* Title & subtitle */}
                        <div className="mb-6">
                            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 mb-3 tracking-tight font-encode">
                                {isVerified ? "Email Verified!" : "Verify Your Email"}
                            </h2>
                            {isVerified ? (
                                <p className="text-emerald-400 text-sm tracking-wide font-medium">
                                    Your email has been successfully verified
                                </p>
                            ) : emailSent ? (
                                <p className="text-zinc-500 text-sm tracking-wide font-medium">
                                    We sent a verification link to<br />
                                    <span className="text-[#DFBD69] font-semibold">{userEmail}</span>
                                </p>
                            ) : (
                                <p className="text-zinc-500 text-sm tracking-wide font-medium">
                                    Sending verification link to{" "}
                                    <span className="text-[#DFBD69] font-semibold">{userEmail}</span>...
                                </p>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 mb-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm"
                            >
                                {error}
                            </motion.div>
                        )}

                        <div className="space-y-4">
                            {/* Waiting state */}
                            {!isVerified && emailSent && (
                                <>
                                    <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm">
                                        <div className="w-4 h-4 border-2 border-[#DFBD69] border-t-transparent rounded-full animate-spin" />
                                        <span>Waiting for verification...</span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleCheckEmailManually}
                                        disabled={isLoading}
                                        className="w-full py-3 rounded-xl bg-[#DFBD69]/10 border border-[#DFBD69]/30 text-[#DFBD69] font-semibold text-sm hover:bg-[#DFBD69]/20 transition-all disabled:opacity-50"
                                    >
                                        {isLoading ? "Checking..." : "I've verified my email"}
                                    </button>

                                    <div className="flex items-center justify-center gap-2 text-sm">
                                        <span className="text-zinc-500">Didn&apos;t receive it?</span>
                                        <button
                                            type="button"
                                            onClick={handleResendEmail}
                                            disabled={!canResend}
                                            className={`font-medium transition-colors flex items-center gap-1.5 ${
                                                canResend
                                                    ? "text-[#DFBD69] hover:text-[#FFD700] cursor-pointer"
                                                    : "text-zinc-600 cursor-not-allowed"
                                            }`}
                                        >
                                            {canResend ? (
                                                <>Resend Email <RefreshCw size={14} /></>
                                            ) : (
                                                <span>Resend in {timeLeft}s</span>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Retry button if send failed */}
                            {!isVerified && !emailSent && !isLoading && error && (
                                <button
                                    type="button"
                                    onClick={handleSendEmail}
                                    className="w-full py-3 rounded-xl bg-[#DFBD69]/10 border border-[#DFBD69]/30 text-[#DFBD69] font-semibold text-sm hover:bg-[#DFBD69]/20 transition-all"
                                >
                                    Retry Sending Email
                                </button>
                            )}

                            {/* Continue - only enabled when verified */}
                            <motion.button
                                whileHover={isVerified ? { scale: 1.01 } : {}}
                                whileTap={isVerified ? { scale: 0.99 } : {}}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                onClick={handleContinue}
                                disabled={!isVerified}
                                className={`group w-full relative overflow-hidden font-bold py-4 rounded-xl shadow-lg font-encode tracking-wide uppercase text-sm ${
                                    isVerified
                                        ? "bg-gradient-to-r from-[#926F34] to-[#DFBD69] text-white shadow-[#926F34]/20"
                                        : "bg-gray-800 text-gray-500 cursor-not-allowed shadow-none"
                                }`}
                            >
                                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                <span className="relative flex items-center justify-center gap-2">
                                    Continue <CheckCircle size={18} />
                                </span>
                            </motion.button>

                            {/* Back / Change Method */}
                            {hasPhone ? (
                                <button
                                    type="button"
                                    onClick={goBackToMethod}
                                    className="flex items-center justify-center gap-2 mx-auto text-zinc-500 hover:text-white text-xs uppercase tracking-wider font-bold transition-colors mt-2"
                                >
                                    <ArrowLeft size={14} /> Change Method
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="flex items-center justify-center gap-2 mx-auto text-zinc-500 hover:text-white text-xs uppercase tracking-wider font-bold transition-colors mt-2"
                                >
                                    <ArrowLeft size={14} /> Back to Registration
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* =============== PHONE VERIFICATION =============== */}
                {view === "phone" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Icon */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border ${
                                isVerified
                                    ? "bg-emerald-500/10 border-emerald-500/20"
                                    : "bg-[#DFBD69]/10 border-[#DFBD69]/20"
                            }`}
                        >
                            {isVerified ? (
                                <ShieldCheck className="text-emerald-400" size={32} />
                            ) : (
                                <Smartphone className="text-[#DFBD69]" size={32} />
                            )}
                        </motion.div>

                        {/* Title & subtitle */}
                        <div className="mb-6">
                            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 mb-3 tracking-tight font-encode">
                                {isVerified ? "Phone Verified!" : "Verify Your Phone"}
                            </h2>
                            {isVerified ? (
                                <p className="text-emerald-400 text-sm tracking-wide font-medium">
                                    Your phone number has been successfully verified
                                </p>
                            ) : codeSent ? (
                                <p className="text-zinc-500 text-sm tracking-wide font-medium">
                                    Enter the 6-digit code sent to<br />
                                    <span className="text-[#DFBD69] font-semibold">{userPhone}</span>
                                </p>
                            ) : (
                                <p className="text-zinc-500 text-sm tracking-wide font-medium">
                                    We&apos;ll send a verification code to<br />
                                    <span className="text-[#DFBD69] font-semibold">{userPhone}</span>
                                </p>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 mb-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm"
                            >
                                {error}
                            </motion.div>
                        )}

                        <div className="space-y-4">
                            {/* Send Code button (before code is sent) */}
                            {!isVerified && !codeSent && (
                                <button
                                    type="button"
                                    onClick={handleSendPhoneCode}
                                    disabled={isLoading}
                                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#926F34] to-[#DFBD69] text-white font-bold text-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Sending...
                                        </span>
                                    ) : (
                                        "Send Verification Code"
                                    )}
                                </button>
                            )}

                            {/* Code entry and verify (after code is sent) */}
                            {!isVerified && codeSent && (
                                <>
                                    {/* 6-digit code entry */}
                                    <div className="flex justify-center gap-3">
                                        {verificationCode.map((digit, index) => (
                                            <input
                                                key={index}
                                                id={`code-${index}`}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handleCodeChange(index, e.target.value)}
                                                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                                                placeholder="0"
                                                aria-label={`Verification code digit ${index + 1}`}
                                                className="w-12 h-14 bg-[#0A0E1A]/60 text-white text-center text-xl font-bold rounded-xl border border-white/5 focus:border-[#DFBD69]/50 focus:bg-[#0A0E1A] focus:ring-1 focus:ring-[#DFBD69]/20 outline-none transition-all duration-300 placeholder:text-zinc-700"
                                            />
                                        ))}
                                    </div>

                                    {/* Verify button */}
                                    <motion.button
                                        whileHover={{ scale: 1.01, boxShadow: "0 0 20px rgba(146, 111, 52, 0.3)" }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={handleVerifyPhoneCode}
                                        disabled={isLoading || verificationCode.join("").length !== 6}
                                        className="group w-full relative overflow-hidden bg-gradient-to-r from-[#926F34] to-[#DFBD69] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#926F34]/20 font-encode tracking-wide uppercase text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                        <span className="relative flex items-center justify-center gap-2">
                                            {isLoading ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    Verifying...
                                                </>
                                            ) : (
                                                <>Verify Code <CheckCircle size={18} /></>
                                            )}
                                        </span>
                                    </motion.button>

                                    {/* Resend */}
                                    <div className="flex items-center justify-center gap-2 text-sm">
                                        <span className="text-zinc-500">Didn&apos;t receive code?</span>
                                        <button
                                            type="button"
                                            onClick={handleResendPhoneCode}
                                            disabled={!canResend}
                                            className={`font-medium transition-colors flex items-center gap-1.5 ${
                                                canResend
                                                    ? "text-[#DFBD69] hover:text-[#FFD700] cursor-pointer"
                                                    : "text-zinc-600 cursor-not-allowed"
                                            }`}
                                        >
                                            {canResend ? (
                                                <>Resend Code <RefreshCw size={14} /></>
                                            ) : (
                                                <span>Resend in {timeLeft}s</span>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Continue after verification */}
                            {isVerified && (
                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.5 }}
                                    onClick={handleContinue}
                                    className="group w-full relative overflow-hidden bg-gradient-to-r from-[#926F34] to-[#DFBD69] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#926F34]/20 font-encode tracking-wide uppercase text-sm"
                                >
                                    <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                    <span className="relative flex items-center justify-center gap-2">
                                        Continue <CheckCircle size={18} />
                                    </span>
                                </motion.button>
                            )}

                            {/* Back / Change Method */}
                            <button
                                type="button"
                                onClick={goBackToMethod}
                                className="flex items-center justify-center gap-2 mx-auto text-zinc-500 hover:text-white text-xs uppercase tracking-wider font-bold transition-colors mt-2"
                            >
                                <ArrowLeft size={14} /> Change Method
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
