import { createApiClient, FetchClient } from './apiClient';
import { API_CONFIG } from '@/constants';

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
}

export const translationService = new TranslationService();
