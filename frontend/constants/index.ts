export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  TIMEOUT: 10000,
  POLLING_INTERVAL: 2000,
  IDLE_POLLING_INTERVAL: 10000,
  MESSAGE_TIMEOUT: 5000,
  TRANSLATION_BASE_URL: process.env.NEXT_PUBLIC_TRANSLATION_SERVICE_URL || 'http://localhost:3001',
} as const;

export const MESSAGES = {
  SUCCESS: {
    PIPELINE_STARTED: 'Парсер успешно запущен',
    PIPELINE_STOPPED: 'Парсер остановлен',
  },
  ERROR: {
    NETWORK: 'Ошибка сети. Проверьте подключение к интернету.',
    SERVER: 'Ошибка сервера. Попробуйте позже.',
    VALIDATION: 'Ошибка валидации данных.',
    STATUS_FETCH: 'Ошибка получения статуса',
    PIPELINE_START: 'Ошибка запуска парсера',
    PIPELINE_STOP: 'Ошибка остановки парсера',
  },
} as const;

export const UI_CONFIG = {
  POLLING_INTERVAL: 2000,
  MESSAGE_TIMEOUT: 5000,
  MAX_POST_LIMIT: 1000,
  MIN_POST_LIMIT: 1,
  ICON_SIZE: 'w-5 h-5',
} as const;


