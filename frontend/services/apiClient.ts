import axios, { type AxiosInstance } from 'axios';
import { API_CONFIG } from '@/constants';

function resolveBaseURL(): string {
  // 1) Явно заданный URL из окружения (рекомендуется на проде)
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) return envUrl;

  // 2) На проде, если переменная не задана — пробуем тот же origin (частый кейс с реверс‑прокси)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return window.location.origin;
  }

  // 3) В разработке по умолчанию стучимся на локальный бэкенд
  return 'http://localhost:8000';
}

export function createApiClient(
  baseURL?: string,
  timeout: number = API_CONFIG.TIMEOUT
): AxiosInstance {
  const instance = axios.create({ baseURL: baseURL ?? resolveBaseURL(), timeout });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Request failed';
      return Promise.reject(new Error(message));
    }
  );

  return instance;
}

export const api: AxiosInstance = createApiClient();
