import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getSession, setSession, updateTokens } from './auth';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
});

const authClient = axios.create({ baseURL: apiBaseUrl, timeout: 15_000 });

const isAuthUrl = (url?: string) => Boolean(url?.startsWith('/auth/'));

apiClient.interceptors.request.use((config) => {
  const session = getSession();
  if (session && !isAuthUrl(config.url)) {
    config.headers.Authorization = `Bearer ${session.access}`;
  }
  return config;
});

let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  const session = getSession();
  if (!session) return Promise.reject(new Error('Not logged in'));
  refreshing ??= authClient
    .post<{ access: string; refresh: string }>('/auth/token/refresh/', { refresh: session.refresh })
    .then(({ data }) => {
      updateTokens(data);
      return data.access;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status !== 401 || !config || isAuthUrl(config.url)) {
      throw error;
    }
    if (!config._retried && getSession()) {
      config._retried = true;
      try {
        const access = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${access}`;
        return apiClient(config);
      } catch {
        /* refresh failed */
      }
    }
    setSession(null);
    throw error;
  },
);

export async function login(username: string, password: string) {
  const { data } = await authClient.post('/auth/token/', { username, password });
  setSession({ access: data.access, refresh: data.refresh, user: data.user });
  return data.user;
}

export async function logout() {
  const session = getSession();
  setSession(null);
  if (session) {
    await authClient.post('/auth/logout/', { refresh: session.refresh }).catch(() => undefined);
  }
}
