"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginForm() {
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { signIn } = useAuth();
    const router = useRouter();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null); // Clear error on input change
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await signIn(formData.email, formData.password);
            // Redirect to dashboard on successful login
            router.push("/dashboard");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Login error:", err);
            setError(err.message || "Failed to sign in. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-8 rounded-2xl bg-gradient-to-br from-[#0A0E1A] via-[#0D1425] to-[#182039] backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden">
            {/* Decorative gradient orb */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#926F34]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#DFBD69]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="text-center mb-8"
                >
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                        Welcome Back
                    </h2>
                    <p className="text-zinc-400 text-sm">
                        Access your stock analytics dashboard
                    </p>
                </motion.div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1, duration: 0.5 }}
                    >
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5 uppercase tracking-wider">
                            Email Address
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#DFBD69] transition-colors">
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                disabled={isLoading}
                                className="w-full bg-zinc-900/50 text-white pl-10 pr-4 py-3 rounded-xl border border-white/10 focus:border-[#DFBD69]/50 focus:ring-1 focus:ring-[#DFBD69]/50 outline-none transition-all placeholder:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="name@example.com"
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-medium text-zinc-300 uppercase tracking-wider">
                                Password
                            </label>
                            <Link
                                href="#"
                                className="text-xs text-[#DFBD69] hover:text-[#926F34] transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#DFBD69] transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                disabled={isLoading}
                                className="w-full bg-zinc-900/50 text-white pl-10 pr-10 py-3 rounded-xl border border-white/10 focus:border-[#DFBD69]/50 focus:ring-1 focus:ring-[#DFBD69]/50 outline-none transition-all placeholder:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Enter your password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-[#DFBD69] transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </motion.div>

                    <motion.button
                        whileHover={{ scale: isLoading ? 1 : 1.02 }}
                        whileTap={{ scale: isLoading ? 1 : 0.98 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 bg-[#926F34] hover:bg-[#7e5e2b] text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-[#926F34]/20 transition-all font-encode disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Signing In...
                            </>
                        ) : (
                            <>
                                Sign In
                                <ArrowRight size={18} />
                            </>
                        )}
                    </motion.button>
                </form>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="mt-8 text-center"
                >
                    <p className="text-zinc-400 text-sm">
                        Dont have an account?{" "}
                        <Link
                            href="/welcome-page/register-page"
                            className="text-[#DFBD69] hover:text-[#926F34] font-medium transition-colors"
                        >
                            create an account
                        </Link>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
