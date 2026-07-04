/**
 * Type Definitions for Backend API
 * 
 * These types match the FastAPI backend response schemas.
 */

export interface UserMeResponse {
  firebase_uid: string;
  first_name: string;
  last_name: string;
  username: string;
  email?: string;
  phone_number?: string;
  avatar_url?: string;
  pin_is_set: boolean;
  subscription_status: "free" | "premium";
  onboarding?: OnboardingResponse;
  created_at: string; // ISO 8601 datetime
}

export interface OnboardingResponse {
  experience_level: "beginner" | "intermediate" | "advanced";
  primary_goal: "trading" | "long_term_investing" | "research_analysis";
  investor_type?: "retail" | "student" | "professional";
  portfolio_size?: "0_500k" | "500k_10m" | "10m_plus";
}

export interface SecurityEventResponse {
  id: number;
  event_type: "pin_set" | "pin_changed" | "pin_verify_success" | "pin_verify_failed" | "pin_locked" | "pin_lockout_expired" | "pin_rate_limited";
  ip_address?: string;
  detail?: string;
  created_at: string;
}

export interface ErrorResponse {
  detail: string;
}

export interface RegisterUserRequest {
  first_name: string;
  last_name: string;
  username: string;
  email?: string;
  phone_number?: string;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  username?: string;
  phone_number?: string;
  avatar_url?: string;
}

export interface OnboardingRequest {
  experience_level: "beginner" | "intermediate" | "advanced";
  primary_goal: "trading" | "long_term_investing" | "research_analysis";
  investor_type?: "retail" | "student" | "professional";
  portfolio_size?: "0_500k" | "500k_10m" | "10m_plus";
}

export interface PinRequest {
  pin: string;
}

export interface PinVerifyResponse {
  verified: boolean;
}

export class RateLimitError extends Error {
  retryAfter: number;
  
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ---- Registration Flow Types (client-side only) ----

/** Data collected from Step 1 (RegisterForm) */
export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  pin: string;
}

/** Data collected from Step 3 (GoToNextStep / Onboarding preferences) */
export interface OnboardingFormData {
  experience: string;
  goal: string;
  investorType: string;
  portfolioSize: string;
}
