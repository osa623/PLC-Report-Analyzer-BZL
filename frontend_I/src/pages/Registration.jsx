import React, { useState } from "react";
import { API_ENDPOINTS } from "../api/endpoints";
import { validateEmail, validatePassword } from "../utils/validation";

export default function Registration() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        if (!validateEmail(email)) {
            setError("Invalid email format");
            return;
        }
        if (!validatePassword(password)) {
            setError("Password must be at least 6 characters");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.REGISTER, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess("Registration successful! Proceeding to MFA Setup...");
                window.location.href = "/setup-mfa?email=" + encodeURIComponent(email);
            } else {
                setError(data.message || "Registration failed");
            }
        } catch {
            setError("Network error");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-apple-md border border-slate-200/60 animate-slide-up">
                <div className="text-center">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-5">
                        <span className="text-white text-sm font-bold">BL</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-heading leading-heading">
                        Create an account
                    </h2>
                    <p className="mt-2 text-[13px] text-slate-500 tracking-refined">
                        Already have an account?{' '}
                        <a href="/login" className="font-medium text-slate-900 hover:text-slate-700 transition-colors duration-200">
                            Sign in
                        </a>
                    </p>
                </div>

                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50/80 text-red-600 text-[13px] p-3 rounded-xl border border-red-200/60 tracking-refined animate-slide-down">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50/80 text-green-600 text-[13px] p-3 rounded-xl border border-green-200/60 tracking-refined animate-slide-down">
                            {success}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email-address" className="block text-[12px] font-medium text-slate-500 mb-1.5 tracking-refined">Email address</label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="appearance-none relative block w-full px-4 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-sm transition-all duration-200 ease-apple tracking-refined"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-[12px] font-medium text-slate-500 mb-1.5 tracking-refined">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                className="appearance-none relative block w-full px-4 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-sm transition-all duration-200 ease-apple tracking-refined"
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all duration-200 ease-apple shadow-apple-sm hover:shadow-apple tracking-refined ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                        >
                            {loading ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : null}
                            {loading ? "Registering..." : "Register"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}