import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../api/endpoints';
import { ArrowLeftIcon, UserCircleIcon, EnvelopeIcon, IdentificationIcon } from '@heroicons/react/24/outline';

export default function Profile() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                // Replace :id with the actual userId
                const url = API_ENDPOINTS.GET_ADMIN.replace(':id', userId);

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    if (response.status === 404) throw new Error('User not found');
                    if (response.status === 401) throw new Error('Unauthorized');
                    throw new Error('Failed to fetch profile');
                }

                const data = await response.json();
                setProfileData(data);
            } catch (err) {
                console.error("Error fetching profile:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchProfile();
        }
    }, [userId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-slate-900"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6 animate-fade-in">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-slate-500 hover:text-slate-900 mb-6 transition-colors duration-200 text-[13px] tracking-refined"
                >
                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                    Back
                </button>
                <div className="bg-red-50/80 border border-red-200/60 text-red-700 px-4 py-3 rounded-xl text-[13px] tracking-refined" role="alert">
                    <strong className="font-semibold">Error: </strong>
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (!profileData) return null;

    return (
        <div className="max-w-4xl mx-auto p-6 animate-fade-in">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center text-slate-500 hover:text-slate-900 mb-6 transition-colors duration-200 text-[13px] tracking-refined"
            >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back
            </button>

            <div className="bg-white shadow-apple-md rounded-2xl overflow-hidden border border-slate-200/60">
                <div className="bg-slate-900 h-28 relative">
                    <div className="absolute -bottom-14 left-8">
                        <div className="w-28 h-28 bg-white rounded-2xl p-1.5 shadow-apple-md">
                            <div className="w-full h-full bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                                <UserCircleIcon className="w-16 h-16" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-20 pb-8 px-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-0.5 tracking-heading">{profileData.email ? profileData.email.split('@')[0] : 'User'}</h1>
                    <p className="text-[13px] text-slate-500 mb-8 tracking-refined">Administrator</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-8">
                        <div className="space-y-2">
                            <div className="flex items-center text-slate-400 mb-1.5">
                                <IdentificationIcon className="w-4 h-4 mr-2" />
                                <span className="text-[12px] font-medium tracking-refined">User ID</span>
                            </div>
                            <p className="text-slate-700 font-mono text-[13px] bg-slate-50 p-3 rounded-xl border border-slate-200/60 break-all tracking-wide">
                                {profileData._id || profileData.id}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center text-slate-400 mb-1.5">
                                <EnvelopeIcon className="w-4 h-4 mr-2" />
                                <span className="text-[12px] font-medium tracking-refined">Email Address</span>
                            </div>
                            <p className="text-slate-900 text-[16px] font-medium tracking-refined">
                                {profileData.email}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}