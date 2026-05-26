import React, { useState } from "react";
import { API_ENDPOINTS } from "../api/endpoints";
import { validateEmail, validateToken } from "../utils/validation";
import { useAuth } from "../utils/AuthContext";
import { useNavigate } from "react-router-dom";

export default function MFAverifyForm() {
    const params = new URLSearchParams(window.location.search);
    const [email] = useState(params.get("email") || "");
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);


    //handle user data passing logic
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleVerify = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        if (!validateEmail(email)) {
            setError("Invalid email format");
            return;
        }
        if (!validateToken(token)) {
            setError("Token is required");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.VERIFY_MFA, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, token }),
                credentials: "include",
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess("MFA verification successful! You are now logged in.");
                // Backend returns { success, token, user: { ... } }
                // We want to store a flattened object with token and user details
                const { token, user } = data;
                login({ ...user, token });

                setTimeout(() => {
                    navigate("/home");
                }, 1000);
            } else {
                setError(data.message || "MFA verification failed");
            }
        } catch (err) {
            console.error(err);
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
                        Two-Factor Authentication
                    </h2>
                    <p className="mt-2 text-[13px] text-slate-500 tracking-refined">
                        Enter the code from your Authenticator app
                    </p>
                </div>

                <form className="mt-8 space-y-5" onSubmit={handleVerify}>
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
                                type="email"
                                readOnly
                                className="appearance-none relative block w-full px-4 py-3 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl focus:outline-none text-sm cursor-not-allowed tracking-refined"
                                value={email}
                            />
                        </div>
                        <div>
                            <label htmlFor="token" className="block text-[12px] font-medium text-slate-500 mb-1.5 tracking-refined">Verification code</label>
                            <input
                                id="token"
                                name="token"
                                type="text"
                                required
                                className="appearance-none relative block w-full px-4 py-3.5 border border-slate-200 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-lg transition-all duration-200 ease-apple tracking-[0.3em] text-center font-medium"
                                placeholder="000 000"
                                maxLength="6"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
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
                            {loading ? "Verifying..." : "Verify Code"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}