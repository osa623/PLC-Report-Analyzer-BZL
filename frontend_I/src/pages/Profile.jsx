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
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-gray-600 hover:text-black mb-6 transition-colors"
                >
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            </div>
        );
    }

    if (!profileData) return null;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center text-gray-600 hover:text-black mb-6 transition-colors"
            >
                <ArrowLeftIcon className="w-5 h-5 mr-2" />
                Back
            </button>

            <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
                <div className="bg-gray-900 h-32 relative">
                    <div className="absolute -bottom-16 left-8">
                        <div className="w-32 h-32 bg-white rounded-full p-2 shadow-md">
                            <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                                <UserCircleIcon className="w-20 h-20" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-20 pb-8 px-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-1">{profileData.email ? profileData.email.split('@')[0] : 'User'}</h1>
                    <p className="text-gray-500 mb-8">Administrator</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 pt-8">
                        <div className="space-y-2">
                            <div className="flex items-center text-gray-500 mb-1">
                                <IdentificationIcon className="w-4 h-4 mr-2" />
                                <span className="text-sm font-medium">User ID</span>
                            </div>
                            <p className="text-gray-900 font-mono text-sm bg-gray-50 p-3 rounded-lg border border-gray-200 break-all">
                                {profileData._id || profileData.id}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center text-gray-500 mb-1">
                                <EnvelopeIcon className="w-4 h-4 mr-2" />
                                <span className="text-sm font-medium">Email Address</span>
                            </div>
                            <p className="text-gray-900 text-lg">
                                {profileData.email}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}