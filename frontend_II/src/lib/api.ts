/**
 * API Client for Backend Communication
 * 
 * Handles all authenticated requests to the FastAPI backend.
 * Automatically attaches Firebase ID tokens and handles common errors.
 */
import axios from 'axios';
import { auth } from './firebase';
import {
  UserMeResponse,
  RegisterUserRequest,
  UpdateProfileRequest,
  OnboardingRequest,
  PinVerifyResponse,
  SecurityEventResponse,
  ErrorResponse,
  RateLimitError,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';
const API_REPORT_URL = process.env.NEXT_PUBLIC_API_REPORT_URL || 'http://localhost:9001/api';




//Authentication API
const authAPIClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Report Fetching API
const dataAPIClient = axios.create({
  baseURL: API_REPORT_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach Firebase ID token to every request made via `api`
authAPIClient.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // If token fetch fails, continue without auth header
  }
  return config;
});


/**
 * Generic API fetch wrapper with authentication and error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Get fresh Firebase ID token
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const token = await user.getIdToken();

  // Prepare headers
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  // Make the request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
    const errorData: ErrorResponse = await response.json().catch(() => ({ detail: 'Rate limited' }));
    throw new RateLimitError(errorData.detail, retryAfter);
  }

  // Handle unauthorized - sign out and redirect
  if (response.status === 401) {
    await auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/welcome-page/login-page';
    }
    throw new Error('Unauthorized - Session expired');
  }

  // Handle other errors
  if (!response.ok) {
    const errorData: ErrorResponse = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(errorData.detail);
  }

  // Handle no-content responses
  if (response.status === 204) {
    return undefined as T;
  }

  // Parse and return JSON
  return response.json();
}

/**
 * Register a new user in the backend database
 * POST /users/me/register
 */
export async function registerUser(data: RegisterUserRequest): Promise<UserMeResponse> {
  return apiFetch<UserMeResponse>('/users/me/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get current authenticated user's profile
 * GET /users/me
 */
export async function getMe(): Promise<UserMeResponse> {
  return apiFetch<UserMeResponse>('/users/me', {
    method: 'GET',
  });
}

/**
 * Update current user's profile
 * PATCH /users/me
 */
export async function updateProfile(data: UpdateProfileRequest): Promise<UserMeResponse> {
  return apiFetch<UserMeResponse>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Set or replace onboarding preferences
 * PUT /users/me/onboarding
 */
export async function updateOnboarding(data: OnboardingRequest): Promise<UserMeResponse> {
  return apiFetch<UserMeResponse>('/users/me/onboarding', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Set or change the user's 6-digit security PIN
 * PUT /users/me/pin
 */
export async function setPin(pin: string): Promise<void> {
  return apiFetch<void>('/users/me/pin', {
    method: 'PUT',
    body: JSON.stringify({ pin }),
  });
}

/**
 * Verify the user's PIN
 * POST /users/me/pin/verify
 */
export async function verifyPin(pin: string): Promise<PinVerifyResponse> {
  return apiFetch<PinVerifyResponse>('/users/me/pin/verify', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

/**
 * Get recent security events for the authenticated user
 * GET /users/me/security-events
 */
export async function getSecurityEvents(): Promise<SecurityEventResponse[]> {
  return apiFetch<SecurityEventResponse[]>('/users/me/security-events', {
    method: 'GET',
  });
}


// ── Financial Data types (Node backend) ─────────────────────────────────

export interface FileReference {
  type: string;
  id: string;
}

export interface YearStructure {
  year: string;
  files: FileReference[];
}

export interface CompanyStructure {
  company: string;
  years: YearStructure[];
}

export interface SectorStructure {
  _id: string;
  companies: CompanyStructure[];
}

export interface ExtractedDataRecord {
  _id: string;
  sector: string;
  company: string;
  year: string;
  type: string;
  data: Record<string, unknown>;
  pdfId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Financial Data API calls (Node backend on /api/data) ────────────────

export const dataApi = {
  /** Get sector → company → year hierarchy */
  getStructure: () =>
    dataAPIClient.get<SectorStructure[]>("/data/structure"),

  /** Get single extracted data record by ID */
  getById: (id: string) =>
    dataAPIClient.get<ExtractedDataRecord>(`/data/${id}`),

  /* Get Company Data By Company Name */
  getCompanyDataByName:(company: string) =>
    dataAPIClient.get<ExtractedDataRecord[]>(`/data/company/${company}`)
};

// ── Helper: fetch all records for a company + report type ───────────────────
// symbol is matched case-insensitively against company names in the structure.
// Returns a map of { [year]: ExtractedDataRecord } for quick year-tab lookup.
export async function getRecordsByCompanyAndType(
  symbol: string,
  type: string
): Promise<Record<string, ExtractedDataRecord>> {
  const { data: sectors } = await dataApi.getStructure();
  const result: Record<string, ExtractedDataRecord> = {};

  for (const sector of sectors) {
    for (const company of sector.companies) {
      // Strict match: company field in DB is stored as the ticker symbol
      const nameMatch =
        company.company.toUpperCase() === symbol.toUpperCase();


      if (!nameMatch) continue;

      for (const yearEntry of company.years) {
        for (const fileRef of yearEntry.files) {
          if (fileRef.type.toLowerCase() === type.toLowerCase()) {
            try {
              const { data: record } = await dataApi.getById(fileRef.id);
              result[yearEntry.year] = record;
            } catch {
              // skip failed individual fetches
            }
          }
        }
      }
    }
  }

  return result;
}

// ── Helper: map an ExtractedDataRecord's `data` field to label/value rows ───
export function mapDataToRows(
  record: ExtractedDataRecord
): { label: string; value: number }[] {
  return Object.entries(record.data)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .map(([label, v]) => ({
      label,
      value: Number(v) || 0,
    }));
}

