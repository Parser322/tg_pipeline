import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pipelineAPI } from '@/services/api';
import { API_CONFIG, MESSAGES } from '@/constants';
import type { PipelineStatus } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

type RunPipelineArgs = {
  postLimit: number;
  periodHours: number | null;
  channelUrl: string | null;
  isTopPosts: boolean;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Неизвестная ошибка';
};

export const usePipeline = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.status,
    queryFn: ({ signal }) => pipelineAPI.status(signal),
    initialData: {
      processed: 0,
      total: 0,
      is_running: false,
      finished: false,
    },
    refetchInterval: (query) =>
      query.state.data?.is_running ? API_CONFIG.POLLING_INTERVAL : API_CONFIG.IDLE_POLLING_INTERVAL,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    staleTime: 2_000,
  });

  const runMutation = useMutation({
    mutationFn: (args: RunPipelineArgs) =>
      pipelineAPI.run(args.postLimit, args.periodHours, args.channelUrl, args.isTopPosts),
    onSuccess: (data) => {
      setSuccess(data.message || MESSAGES.SUCCESS.PIPELINE_STARTED);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err) || MESSAGES.ERROR.PIPELINE_START);
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => pipelineAPI.stop(),
    onSuccess: (data) => {
      setSuccess(data.message || MESSAGES.SUCCESS.PIPELINE_STOPPED);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err) || MESSAGES.ERROR.PIPELINE_STOP);
    },
  });

  const runPipeline = useCallback(
    async (postLimit: number, periodHours: number, channelUrl: string, isTopPosts: boolean) => {
      setSuccess(null);
      setError(null);
      await runMutation.mutateAsync({ postLimit, periodHours, channelUrl, isTopPosts });
    },
    [runMutation]
  );

  const stopPipeline = useCallback(async () => {
    setError(null);
    await stopMutation.mutateAsync();
  }, [stopMutation]);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, API_CONFIG.MESSAGE_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return {
    status: statusQuery.data,
    isLoading: runMutation.isPending || stopMutation.isPending,
    error,
    success,
    fetchStatus: statusQuery.refetch,
    runPipeline,
    stopPipeline,
    clearMessages,
  };
};
