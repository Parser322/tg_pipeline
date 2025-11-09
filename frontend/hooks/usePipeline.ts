import { useState, useEffect, useCallback, useRef } from 'react';
import { pipelineAPI } from '@/services/api';
import { API_CONFIG, MESSAGES } from '@/constants';
import type { PipelineStatus } from '@/types/api';

type PipelineHookState = {
  status: PipelineStatus;
  isLoading: boolean;
  error: string | null;
  success: string | null;
};

export const usePipeline = () => {
  const [status, setStatus] = useState<PipelineStatus>({
    processed: 0,
    total: 0,
    is_running: false,
    finished: false,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await pipelineAPI.status();
      setStatus(response.data);
    } catch (err) {
      console.error(MESSAGES.ERROR.STATUS_FETCH, err);
    }
  }, []);

  const runPipeline = useCallback(
    async (postLimit: number, periodHours: number, channelUrl: string, isTopPosts: boolean) => {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await pipelineAPI.run(postLimit, periodHours, channelUrl, isTopPosts);
        setSuccess(response.data.message || null);
        // Сразу получаем актуальный статус и даем шанс эффекту запустить быстрый опрос
        await fetchStatus();
      } catch (err: any) {
        const errorMessage = (err as Error).message || MESSAGES.ERROR.PIPELINE_START;
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchStatus]
  );

  const stopPipeline = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await pipelineAPI.stop();
      setSuccess(response.data.message || null);
      // Обновляем статус немедленно
      await fetchStatus();
    } catch (err: any) {
      const errorMessage = (err as Error).message || MESSAGES.ERROR.PIPELINE_STOP;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  useEffect(() => {
    // Опросим статус периодически всегда:
    // - при активном процессе — быстро
    // - в простое — реже, чтобы вовремя подхватывать переходы в running/finished
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const intervalMs = status.is_running
      ? API_CONFIG.POLLING_INTERVAL
      : API_CONFIG.IDLE_POLLING_INTERVAL;
    intervalRef.current = setInterval(fetchStatus, intervalMs);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status.is_running, fetchStatus]);

  // Обновляем статус при смене видимости вкладки (экономим запросы в фоне)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // При возврате во вкладку — получить актуальный статус
        fetchStatus();
        // Интервалы управляются основным эффектом; здесь ничего не запускаем
      } else {
        // В фоне — останавливаем опрос (он восстановится при возврате)
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fetchStatus]);

  // Разовое обновление при возврате фокуса окна
  useEffect(() => {
    const onFocus = () => fetchStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchStatus]);

  useEffect(() => {
    if (error || success) {
      timeoutRef.current = setTimeout(clearMessages, API_CONFIG.MESSAGE_TIMEOUT);
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [error, success, clearMessages]);

  useEffect(() => {
    fetchStatus();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    success,
    fetchStatus,
    runPipeline,
    stopPipeline,
    clearMessages,
  };
};
