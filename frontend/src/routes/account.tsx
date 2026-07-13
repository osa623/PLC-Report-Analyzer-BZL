import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Page } from "@/components/TopNav";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/lib/store/auth-store";
import { updateUserProfile, changeUserPassword } from "@/lib/api";
import { User, Mail, Building, Lock, ShieldAlert, LogOut, CheckCircle, Key } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — FDI" },
      { name: "description", content: "Manage your user profile and security settings." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const navigate = useNavigate();

  // Profile Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setOrganization(user.organization);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !organization) {
      setProfileError("All profile fields are required.");
      return;
    }
    
    setProfileLoading(true);
    setProfileError("");

    try {
      const response = await updateUserProfile({ name, email, organization });
      updateUser(response.user);
      toast.success("Profile updated successfully!");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile.");
      toast.error("Failed to update profile details.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError("Password must be at least 8 characters long and contain both letters and numbers.");
      return;
    }

    setPasswordLoading(true);
    setPasswordError("");

    try {
      await changeUserPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully!");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
      toast.error("Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully.");
    navigate({ to: "/" });
  };

  // Get initials for profile badge
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "US";

  return (
    <Page>
      <div className="max-w-4xl mx-auto font-sans">
        {/* Page Intro */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-600 mb-2">
              Settings & Privacy
            </p>
            <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-[var(--navy)]">
              Account Management
            </h1>
            <p className="text-[14px] text-gray-500 mt-1">
              Update your personal details, secure your workspace, and configure settings.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-red-50/20 px-4 text-[13px] font-bold text-red-650 hover:bg-red-50 transition-colors shadow-sm cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout session</span>
          </button>
        </div>

        {/* User Card Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 overflow-hidden rounded-3xl border border-gray-150 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] flex flex-col md:flex-row gap-6 items-center"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--navy)] to-[#1E3A8A] text-[20px] font-bold text-white shadow-md">
            {initials}
          </div>
          <div className="text-center md:text-left flex-1">
            <h3 className="text-lg font-bold text-[#0B1F3A]">{user?.name}</h3>
            <p className="text-sm text-gray-500 flex items-center justify-center md:justify-start gap-1.5 mt-0.5">
              <Mail className="h-3.5 w-3.5 text-gray-400" /> {user?.email}
            </p>
            <p className="text-xs text-gray-450 mt-1 flex items-center justify-center md:justify-start gap-1.5">
              <Building className="h-3.5 w-3.5 text-gray-400" /> {user?.organization}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2 shrink-0">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800">Secure Account</span>
          </div>
        </motion.div>

        {/* Grid Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Update Profile Details */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center gap-3 border-b border-gray-50 px-6 py-4 bg-slate-50/20">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <User className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                  Profile Details
                </h2>
                <p className="text-xs text-gray-400">
                  Manage your name, email and workspace details.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="flex-1 p-6 space-y-4">
              {profileError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/50 p-3 text-[11px] font-semibold text-red-600">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Name field */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl text-[13.5px] text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                  />
                </div>
              </div>

              {/* Email field */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl text-[13.5px] text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                  />
                </div>
              </div>

              {/* Organization field */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                  Organization
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                    <Building className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl text-[13.5px] text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="flex justify-center items-center py-2.5 px-5 border border-transparent rounded-2xl text-[13px] font-bold text-white bg-[#0B1F3A] hover:bg-[#071426] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors shadow-md w-full sm:w-auto"
                >
                  {profileLoading ? "Saving changes..." : "Save changes"}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Section 2: Security & Password */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center gap-3 border-b border-gray-50 px-6 py-4 bg-slate-50/20">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Lock className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                  Password & Security
                </h2>
                <p className="text-xs text-gray-400">
                  Change your password to secure your credentials.
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="flex-1 p-6 space-y-4">
              {passwordError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/50 p-3 text-[11px] font-semibold text-red-600">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {/* Current Password field */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                  Current Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl text-[13.5px] text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all placeholder:text-gray-300"
                  />
                </div>
              </div>

              {/* New Password field */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="Create new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl text-[13.5px] text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all placeholder:text-gray-300"
                  />
                </div>
              </div>

              {/* Confirm New Password field */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 ml-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl text-[13.5px] text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 transition-all placeholder:text-gray-300"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex justify-center items-center py-2.5 px-5 border border-transparent rounded-2xl text-[13px] font-bold text-white bg-[#0B1F3A] hover:bg-[#071426] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors shadow-md w-full sm:w-auto"
                >
                  {passwordLoading ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>

        {/* API keys & advanced details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center gap-3 border-b border-gray-50 px-6 py-4 bg-slate-50/20">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Key className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                Workspace Credentials & API Keys
              </h2>
              <p className="text-xs text-gray-400">
                Developer API keys for automated pipeline submission.
              </p>
            </div>
          </div>
          <div className="p-6">
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Integrate the FDI processing engine directly into your local deployment. Submit files via curl or script using this workspace's authorization parameters.
            </p>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="font-mono text-xs text-slate-600 select-all truncate max-w-full sm:max-w-md">
                Bearer fdi_token_{user?.id || "unregistered_session_token_key"}
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`Bearer fdi_token_${user?.id || "token"}`);
                  toast.success("API key copied to clipboard!");
                }}
                className="text-xs font-bold text-blue-650 hover:underline shrink-0 cursor-pointer"
              >
                Copy authorization header
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </Page>
  );
}
