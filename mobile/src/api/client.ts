import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { tokenService } from '@/services/tokenService';

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenService.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;
    refreshPromise =
      refreshPromise ||
      tokenService.getRefreshToken().then(async (refreshToken) => {
        if (!refreshToken) return null;
        const response = await axios.post(`${env.apiBaseUrl}/auth/refresh`, { refreshToken });
        const accessToken = response.data?.accessToken;
        if (accessToken) {
          await tokenService.setTokens(accessToken, response.data?.refreshToken);
        }
        return accessToken || null;
      }).finally(() => {
        refreshPromise = null;
      });

    const nextToken = await refreshPromise;
    if (!nextToken) {
      await tokenService.clear();
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${nextToken}`;
    return apiClient(original);
  },
);

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: string; message?: string } | undefined;
    return payload?.message || payload?.error || error.message;
  }
  return error instanceof Error ? error.message : 'Unexpected network error';
}
