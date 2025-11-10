import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saveChannel, checkChannel, deleteCurrentChannel, getCurrentChannel } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Неизвестная ошибка';
};

export const useChannel = () => {
  const queryClient = useQueryClient();
  const [channelUsername, setChannelUsername] = useState<string>('');
  const [channelError, setChannelError] = useState<string | null>(null);
  const [channelMessage, setChannelMessage] = useState<string | null>(null);
  const channelCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Запрос текущего канала
  const currentChannelQuery = useQuery({
    queryKey: queryKeys.channel.current,
    queryFn: ({ signal }) => getCurrentChannel(signal),
    staleTime: 5 * 60 * 1000, // 5 минут
    retry: 1,
  });

  // Мутация для сохранения канала
  const saveChannelMutation = useMutation({
    mutationFn: (username: string) => saveChannel(username),
    onSuccess: (data) => {
      if (data.ok) {
        setChannelMessage('Канал сохранён');
        setChannelError(null);
        void queryClient.invalidateQueries({ queryKey: queryKeys.channel.current });
      }
    },
    onError: (err: unknown) => {
      setChannelMessage(null);
      setChannelError(getErrorMessage(err) || 'Ошибка при сохранении канала');
    },
  });

  // Мутация для удаления канала
  const deleteChannelMutation = useMutation({
    mutationFn: () => deleteCurrentChannel(),
    onSuccess: (data) => {
      if (data.ok) {
        setChannelMessage('Канал удалён');
        setChannelError(null);
        void queryClient.invalidateQueries({ queryKey: queryKeys.channel.current });
      }
    },
    onError: (err: unknown) => {
      setChannelMessage(null);
      setChannelError(getErrorMessage(err) || 'Ошибка при удалении канала');
    },
  });

  // Инициализация из localStorage или API
  useEffect(() => {
    if (currentChannelQuery.data?.channel?.username) {
      const username = currentChannelQuery.data.channel.username;
      setChannelUsername(username);
      localStorage.setItem('lastUsedChannel', username);
    } else if (currentChannelQuery.isError) {
      const savedChannel = localStorage.getItem('lastUsedChannel');
      if (savedChannel) {
        setChannelUsername(savedChannel);
      }
    }
  }, [currentChannelQuery.data, currentChannelQuery.isError]);

  const isChannelSaved = !!currentChannelQuery.data?.channel?.username;

  const handleChannelSave = useCallback(
    async (username: string) => {
      if (!username.trim()) return;
      await saveChannelMutation.mutateAsync(username);
    },
    [saveChannelMutation]
  );

  const handleChannelUnsave = useCallback(async () => {
    await deleteChannelMutation.mutateAsync();
  }, [deleteChannelMutation]);

  const handleChannelChange = useCallback(
    async (username: string) => {
      setChannelUsername(username);
      if (username.trim()) {
        localStorage.setItem('lastUsedChannel', username);
      } else {
        localStorage.removeItem('lastUsedChannel');
      }

      if (!username.trim()) {
        if (channelCheckRef.current) {
          clearTimeout(channelCheckRef.current);
          channelCheckRef.current = null;
        }
        return;
      }

      // Debounce проверки канала
      if (channelCheckRef.current) {
        clearTimeout(channelCheckRef.current);
        channelCheckRef.current = null;
      }

      channelCheckRef.current = setTimeout(async () => {
        try {
          await checkChannel(username);
          // После проверки инвалидируем кэш текущего канала
          void queryClient.invalidateQueries({ queryKey: queryKeys.channel.current });
        } catch (err) {
          console.error('Failed to check channel:', err);
        }
      }, 400);
    },
    [queryClient]
  );

  useEffect(() => {
    return () => {
      if (channelCheckRef.current) {
        clearTimeout(channelCheckRef.current);
      }
    };
  }, []);

  return {
    channelUsername,
    isChannelSaved,
    channelError,
    channelMessage,
    handleChannelSave,
    handleChannelUnsave,
    handleChannelChange,
    isLoading: saveChannelMutation.isPending || deleteChannelMutation.isPending,
  };
};
