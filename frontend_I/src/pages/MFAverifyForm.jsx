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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Two-Factor Authentication
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Enter the code from your Authenticator app
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleVerify}>
                    {error && (
                        <div className="bg-red-50 text-red-500 text-sm p-3 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 text-green-500 text-sm p-3 rounded-lg border border-green-100">
                            {success}
                        </div>
                    )}

                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <label htmlFor="email-address" className="sr-only">Email address</label>
                            <input
                                id="email-address"
                                type="email"
                                readOnly
                                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 bg-gray-50 text-gray-500 rounded-lg focus:outline-none sm:text-sm cursor-not-allowed"
                                value={email}
                            />
                        </div>
                        <div>
                            <label htmlFor="token" className="sr-only">MFA Code</label>
                            <input
                                id="token"
                                name="token"
                                type="text"
                                required
                                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent sm:text-sm transition-all tracking-widest text-center text-lg"
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
                            className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
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