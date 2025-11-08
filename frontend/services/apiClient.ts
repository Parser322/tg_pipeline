import axios, { type AxiosInstance } from 'axios';
import { API_CONFIG } from '@/constants';

export function createApiClient(baseURL: string = API_CONFIG.BASE_URL, timeout: number = API_CONFIG.TIMEOUT): AxiosInstance {
  const instance = axios.create({ baseURL, timeout });

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



