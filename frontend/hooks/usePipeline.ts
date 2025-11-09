import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pipelineAPI } from '@/services/api';
import { API_CONFIG, MESSAGES } from '@/constants';
import type { PipelineStatus } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

export const usePipeline = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.status,
    queryFn: async () => {
      const response = await pipelineAPI.status();
      return response.data as PipelineStatus;
    },
    initialData: {
      processed: 0,
      total: 0,
      is_running: false,
      finished: false,
    } as PipelineStatus,
    refetchInterval: (q) =>
      q.state.data?.is_running ? API_CONFIG.POLLING_INTERVAL : API_CONFIG.IDLE_POLLING_INTERVAL,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    staleTime: 2_000,
  });

  const runMutation = useMutation({
    mutationFn: (args: {
      postLimit: number;
      periodHours: number | null;
      channelUrl: string | null;
      isTopPosts: boolean;
    }) => pipelineAPI.run(args.postLimit, args.periodHours, args.channelUrl, args.isTopPosts),
    onSuccess: (res) => {
      setSuccess(res.data.message || MESSAGES.SUCCESS.PIPELINE_STARTED);
      setError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
    onError: (err: any) => {
      setError((err as Error).message || MESSAGES.ERROR.PIPELINE_START);
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => pipelineAPI.stop(),
    onSuccess: (res) => {
      setSuccess(res.data.message || MESSAGES.SUCCESS.PIPELINE_STOPPED);
      setError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
    onError: (err: any) => {
      setError((err as Error).message || MESSAGES.ERROR.PIPELINE_STOP);
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
      const t = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, API_CONFIG.MESSAGE_TIMEOUT);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  return {
    status: statusQuery.data as PipelineStatus,
    isLoading: runMutation.isPending || stopMutation.isPending,
    error,
    success,
    fetchStatus: statusQuery.refetch,
    runPipeline,
    stopPipeline,
    clearMessages,
  };
};
