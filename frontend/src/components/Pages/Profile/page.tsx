"use client";

import React, { useState } from "react";
import {
  Camera,
  Lock,
  Mail,
  Shield,
  Eye,
  EyeOff,
  User,
  Phone,
  Crown,
  Calendar,
  ChevronRight,
  Check,
  X,
  Loader2,
  KeyRound,
  Activity,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "@/lib/api";

type EditMode = "avatar" | "email" | "password" | "pin" | null;

/* ───── Dice-Bear Avatar Seeds ───── */
const AVATAR_STYLES = [
  "adventurer", "adventurer-neutral", "avataaars", "big-ears",
  "big-smile", "bottts", "croodles", "fun-emoji",
  "icons", "identicon", "lorelei", "micah",
  "miniavs", "notionists", "open-peeps", "personas",
  "pixel-art", "thumbs",
];

function generateAvatarUrl(style: string, seed: string) {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export default function Profile() {
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [showPin, setShowPin] = useState(false);
  const { firebaseUser, backendUser, refreshProfile } = useAuth();

  /* ── Avatar editor state ── */
  const [selectedStyle, setSelectedStyle] = useState(AVATAR_STYLES[0]);
  const [avatarSeed, setAvatarSeed] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);

  /* ── Email editor state ── */
  const [newEmail, setNewEmail] = useState("");

  /* ── Password editor state ── */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  /* ── PIN editor state ── */
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");



  /* ── Derived user data ── */
  const firstName = backendUser?.first_name || "—";
  const lastName = backendUser?.last_name || "—";
  const username = backendUser?.username || firebaseUser?.email?.split("@")[0] || "—";
  const email = backendUser?.email || firebaseUser?.email || "—";
  const phone = backendUser?.phone_number || "—";
  const isPremium = backendUser?.subscription_status === "premium";
  const avatarUrl = backendUser?.avatar_url || "/avatar.png";
  const memberSince = backendUser?.created_at
    ? new Date(backendUser.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  const experience = backendUser?.onboarding?.experience_level || "—";
  const goal = backendUser?.onboarding?.primary_goal?.replace(/_/g, " ") || "—";
  const investorType = backendUser?.onboarding?.investor_type?.replace(/_/g, " ") || "—";

  /* ── Handlers ── */
  const handleSaveAvatar = async () => {
    setAvatarSaving(true);
    try {
      const url = generateAvatarUrl(selectedStyle, avatarSeed || username);
      await updateProfile({ avatar_url: url });
      await refreshProfile();
      setEditMode(null);
    } catch {
      /* silent */
    } finally {
      setAvatarSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditMode(null);
    setNewEmail("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNewPin("");
    setConfirmPin("");
  };

  return (
    <div className="min-h-screen bg-transparent text-gray-100 font-sans selection:bg-[#DFBD69]/30 pb-20 overflow-x-hidden">

      {/* ── Ambient glow ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#DFBD69]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-[#10b981]/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ╔═══════════════════════ HEADER ═══════════════════════╗ */}
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-px w-8 bg-[#DFBD69]" />
            <span className="text-xs font-bold text-[#DFBD69] uppercase tracking-[0.2em]">BUYZONLABS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#DFBD69] via-[#F7E7CE] to-[#ffffff] font-encode">
            My Profile
          </h1>
          <p className="text-gray-400 mt-2 text-sm max-w-md">
            Manage your account settings, security, and preferences.
          </p>
        </header>

        {/* ╔═══════════════════════ GRID ═══════════════════════╗ */}
        <div className="grid grid-cols-12 gap-6 lg:gap-8">

          {/* ═══════════ LEFT COLUMN (Profile Card) ═══════════ */}
          <div className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-6">

            {/* ── Identity Card ── */}
            <div className="bg-[#131B2C]/80 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl overflow-hidden">

              {/* Banner gradient */}
              <div className="h-24 bg-gradient-to-br from-[#DFBD69]/20 via-[#926F34]/10 to-transparent relative">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />
              </div>

              {/* Avatar positioned over banner */}
              <div className="flex flex-col items-center -mt-14 px-6 pb-6">
                <div className="relative group">
                  <div className="w-28 h-28 rounded-full ring-4 ring-[#131B2C] overflow-hidden bg-[#1a2340]">
                    <img
                      src={avatarUrl}
                      alt="Profile Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => setEditMode("avatar")}
                    aria-label="Change avatar"
                    className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-gradient-to-r from-[#B28D41] to-[#E9D37E] flex items-center justify-center shadow-lg shadow-[#B28D41]/30 hover:scale-110 transition-transform cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#0D1325]" />
                  </button>
                </div>

                {/* Name & tag */}
                <h2 className="mt-4 text-xl font-bold text-white font-encode">{firstName} {lastName}</h2>
                <span className="text-sm text-[#DFBD69] font-medium">@{username}</span>

                {/* Subscription badge */}
                <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isPremium
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-[#DFBD69]/10 text-[#DFBD69] border border-[#DFBD69]/20"
                }`}>
                  <Crown className="w-3 h-3" />
                  {isPremium ? "Premium" : "Free Plan"}
                </div>
              </div>
            </div>

            {/* ── Details Card ── */}
            <div className="bg-[#131B2C]/80 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl p-6 space-y-1">
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-widest mb-4">Account Details</h3>

              <DetailRow icon={<Mail className="w-4 h-4" />} label="Email" value={email} />
              <DetailRow icon={<Phone className="w-4 h-4" />} label="Phone" value={phone} />
              <DetailRow icon={<Calendar className="w-4 h-4" />} label="Member Since" value={memberSince} />
              <DetailRow icon={<KeyRound className="w-4 h-4" />} label="PIN Status" value={backendUser?.pin_is_set ? "Configured" : "Not Set"} valueColor={backendUser?.pin_is_set ? "text-emerald-400" : "text-amber-400"} />
            </div>

            {/* ── Preferences Card ── */}
            <div className="bg-[#131B2C]/80 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl p-6 space-y-1">
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-widest mb-4">Investment Profile</h3>

              <DetailRow icon={<Activity className="w-4 h-4" />} label="Experience" value={experience} capitalize />
              <DetailRow icon={<ChevronRight className="w-4 h-4" />} label="Goal" value={goal} capitalize />
              <DetailRow icon={<User className="w-4 h-4" />} label="Investor Type" value={investorType} capitalize />
            </div>
          </div>

          {/* ═══════════ RIGHT COLUMN (Settings) ═══════════ */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col gap-6">

            {/* ── Security & Settings Header ── */}
            <div className="bg-[#131B2C]/80 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl p-6">
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-widest mb-1">Settings</h3>
              <p className="text-sm text-gray-500">Update your security credentials and profile details.</p>
            </div>

            {/* ── Avatar Setting ── */}
            <SettingsCard
              icon={<Camera className="w-5 h-5 text-sky-400" />}
              title="Profile Avatar"
              description="Choose a unique avatar from various DiceBear styles."
              active={editMode === "avatar"}
              onEdit={() => setEditMode("avatar")}
              onCancel={cancelEdit}
            >
              <div className="space-y-4">
                {/* Seed input */}
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Seed (name, word, anything)</label>
                  <input
                    type="text"
                    value={avatarSeed}
                    onChange={(e) => setAvatarSeed(e.target.value)}
                    placeholder={username}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm outline-none focus:border-[#DFBD69]/50 transition-colors placeholder:text-gray-600"
                  />
                </div>

                {/* Style selector */}
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">Style</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {AVATAR_STYLES.map((style) => (
                      <button
                        key={style}
                        onClick={() => setSelectedStyle(style)}
                        className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
                          selectedStyle === style
                            ? "border-[#DFBD69] bg-[#DFBD69]/10"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                        }`}
                      >
                        <img
                          src={generateAvatarUrl(style, avatarSeed || username)}
                          alt={style}
                          className="w-10 h-10 rounded-lg"
                        />
                        <span className="text-[10px] text-gray-400 truncate w-full text-center">{style}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-4 pt-2">
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#DFBD69]/30 bg-[#1a2340]">
                    <img
                      src={generateAvatarUrl(selectedStyle, avatarSeed || username)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-300 font-medium">Preview</p>
                    <p className="text-xs text-gray-500">{selectedStyle} / {avatarSeed || username}</p>
                  </div>
                </div>
              </div>

              {/* Custom save for avatar */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSaveAvatar}
                  disabled={avatarSaving}
                  className="flex items-center gap-2 cursor-pointer font-encode font-medium bg-gradient-to-r from-[#B28D41] to-[#E9D37E] text-[#0D1325] rounded-xl hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-300 hover:scale-105 px-5 py-2.5 text-sm disabled:opacity-50 disabled:hover:scale-100"
                >
                  {avatarSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Avatar
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </SettingsCard>

            {/* ── Email Setting ── */}
            <SettingsCard
              icon={<Mail className="w-5 h-5 text-emerald-400" />}
              title="Email Address"
              description={email}
              active={editMode === "email"}
              onEdit={() => setEditMode("email")}
              onCancel={cancelEdit}
            >
              <div className="space-y-3">
                <InputField label="New Email" type="email" value={newEmail} onChange={setNewEmail} placeholder="your@newemail.com" />
                <InputField label="Current Password" type="password" value={currentPassword} onChange={setCurrentPassword} placeholder="Verify your identity" />
              </div>
            </SettingsCard>

            {/* ── Password Setting ── */}
            <SettingsCard
              icon={<Lock className="w-5 h-5 text-purple-400" />}
              title="Password"
              description="Last changed: Unknown"
              active={editMode === "password"}
              onEdit={() => setEditMode("password")}
              onCancel={cancelEdit}
            >
              <div className="space-y-3">
                <InputField label="Current Password" type="password" value={currentPassword} onChange={setCurrentPassword} placeholder="Enter current password" />
                <div className="relative">
                  <InputField
                    label="New Password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="Min 8 characters"
                  />
                  <button
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-[34px] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <InputField label="Confirm New Password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter new password" />

                {/* Password strength */}
                {newPassword && (
                  <div className="pt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            newPassword.length >= i * 3
                              ? i <= 1 ? "bg-red-500" : i <= 2 ? "bg-amber-500" : i <= 3 ? "bg-emerald-400" : "bg-emerald-500"
                              : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {newPassword.length < 6 ? "Weak" : newPassword.length < 9 ? "Fair" : newPassword.length < 12 ? "Strong" : "Very Strong"}
                    </p>
                  </div>
                )}
              </div>
            </SettingsCard>

            {/* ── Security PIN Setting ── */}
            <SettingsCard
              icon={<Shield className="w-5 h-5 text-rose-400" />}
              title="Security PIN"
              description={backendUser?.pin_is_set ? "6-digit PIN is configured" : "No PIN set yet"}
              active={editMode === "pin"}
              onEdit={() => setEditMode("pin")}
              onCancel={cancelEdit}
            >
              <div className="space-y-3">
                <InputField label="New 6-Digit PIN" type={showPin ? "text" : "password"} value={newPin} onChange={(v) => setNewPin(v.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" inputMode="numeric" />
                <InputField label="Confirm PIN" type={showPin ? "text" : "password"} value={confirmPin} onChange={(v) => setConfirmPin(v.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" inputMode="numeric" />
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 select-none">
                  <input
                    type="checkbox"
                    checked={showPin}
                    onChange={() => setShowPin(!showPin)}
                    className="rounded border-white/20 bg-black/30 text-[#DFBD69] focus:ring-[#DFBD69]/30"
                  />
                  Show PIN digits
                </label>
              </div>
            </SettingsCard>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════ */

/** Left-column detail row with icon */
function DetailRow({
  icon,
  label,
  value,
  valueColor,
  capitalize,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="text-gray-500">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-medium truncate ${valueColor || "text-gray-200"} ${capitalize ? "capitalize" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

/** Reusable input field */
function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "email";
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm outline-none focus:border-[#DFBD69]/50 transition-colors placeholder:text-gray-600"
      />
    </div>
  );
}

/** Right-column settings card with expand/collapse */
function SettingsCard({
  icon,
  title,
  description,
  children,
  active,
  onEdit,
  onCancel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  active: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={`bg-[#131B2C]/80 backdrop-blur-xl rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 ${
      active ? "border-[#DFBD69]/20" : "border-white/5"
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-3 rounded-2xl bg-white/[0.04] shrink-0">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-gray-500 truncate">{description}</p>
          </div>
        </div>

        {!active && (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 cursor-pointer font-encode font-medium bg-gradient-to-r from-[#B28D41] to-[#E9D37E] text-[#0D1325] rounded-xl hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-300 hover:scale-105 px-5 py-2.5 text-sm shrink-0"
          >
            Edit
          </button>
        )}

        {active && (
          <button
            onClick={onCancel}
            aria-label="Cancel editing"
            className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Expanded form */}
      {active && (
        <div className="px-6 pb-6 border-t border-white/5 pt-5">
          {children}

          {/* Default save/cancel — avatar card supplies its own */}
          {title !== "Profile Avatar" && (
            <div className="flex gap-3 mt-5">
              <button className="flex items-center gap-2 cursor-pointer font-encode font-medium bg-gradient-to-r from-[#B28D41] to-[#E9D37E] text-[#0D1325] rounded-xl hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-300 hover:scale-105 px-5 py-2.5 text-sm">
                <Check className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
