import { createApiClient, FetchClient } from './apiClient';
import { API_CONFIG } from '@/constants';
import type { ImageTranslateResult } from '@/types/api';

type TranslateTextOptions = {
  targetLanguage?: string;
  size?: string;
  [key: string]: unknown;
};

type HealthCheckResult = {
  status: string;
  error?: string;
};

class TranslationService {
  private client: FetchClient;

  constructor() {
    this.client = createApiClient(API_CONFIG.TRANSLATION_BASE_URL, API_CONFIG.TIMEOUT);
  }

  async translateText(text: string, options: Record<string, unknown> = {}): Promise<unknown> {
    return this.client.post('/translate', { text, ...options });
  }

  async translateBatch(texts: string[], options: Record<string, unknown> = {}): Promise<unknown> {
    return this.client.post('/translate/batch', { texts, ...options });
  }

  async getConfig(): Promise<unknown> {
    return this.client.get('/config');
  }

  async checkHealth(): Promise<HealthCheckResult> {
    try {
      return await this.client.get<HealthCheckResult>('/health');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', error: message };
    }
  }

  async translateImage(imageBase64: string, options: TranslateTextOptions = {}): Promise<unknown> {
    return this.client.post('/translate/image', { imageBase64, ...options });
  }

  async translateImageWithGpt(
    imageBase64: string,
    options: TranslateTextOptions = {}
  ): Promise<ImageTranslateResult> {
    return this.client.post<ImageTranslateResult>('/translate/image-gpt', {
      imageBase64,
      ...options,
    });
  }
}

export const translationService = new TranslationService();
