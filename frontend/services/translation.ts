import { createApiClient } from './apiClient';
import { API_CONFIG } from '@/constants';
import type { AxiosInstance } from 'axios';
import type { ImageTranslateResult } from '@/types/api';

type TranslateTextOptions = {
  targetLanguage?: string;
  size?: string;
  [key: string]: unknown;
};

class TranslationService {
  private api: AxiosInstance;

  constructor() {
    this.api = createApiClient(API_CONFIG.TRANSLATION_BASE_URL, API_CONFIG.TIMEOUT);
  }

  async translateText(text: string, options: Record<string, unknown> = {}) {
    const response = await this.api.post(`/translate`, { text, ...options });
    return response.data as unknown;
  }

  async translateBatch(texts: string[], options: Record<string, unknown> = {}) {
    const response = await this.api.post(`/translate/batch`, { texts, ...options });
    return response.data as unknown;
  }

  async getConfig() {
    const response = await this.api.get(`/config`);
    return response.data as unknown;
  }

  async checkHealth() {
    try {
      const response = await this.api.get(`/health`);
      return response.data as unknown;
    } catch (error: any) {
      return { status: 'unhealthy', error: error?.message as string | undefined };
    }
  }

  async translateImage(imageBase64: string, options: TranslateTextOptions = {}) {
    const response = await this.api.post(`/translate/image`, { imageBase64, ...options });
    return response.data as unknown;
  }

  async translateImageWithGpt(imageBase64: string, options: TranslateTextOptions = {}) {
    const response = await this.api.post(`/translate/image-gpt`, { imageBase64, ...options });
    return response.data as ImageTranslateResult;
  }
}

export const translationService = new TranslationService();



