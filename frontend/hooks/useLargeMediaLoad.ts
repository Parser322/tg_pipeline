import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loadLargeMedia } from '@/services/api';
import { toast } from 'sonner';

interface UseLargeMediaLoadParams {
  postId: string;
  mediaId: string;
  onSuccess?: (newUrl: string) => void;
}

export function useLargeMediaLoad({ postId, mediaId, onSuccess }: UseLargeMediaLoadParams) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => loadLargeMedia(postId, mediaId),
    onSuccess: (data) => {
      if (data.ok && data.url) {
        // Инвалидируем кэш постов, чтобы обновить данные
        queryClient.invalidateQueries({ queryKey: ['posts'] });
        
        // Вызываем колбэк с новым URL
        if (onSuccess) {
          onSuccess(data.url);
        }
        
        // Показываем успешное уведомление
        toast.success('Медиафайл загружен', {
          description: 'Файл успешно загружен и теперь доступен.',
        });
      } else {
        throw new Error(data.error || 'Не удалось загрузить медиафайл');
      }
    },
    onError: (error: Error) => {
      console.error('Error loading large media:', error);
      toast.error('Ошибка загрузки', {
        description: error.message || 'Не удалось загрузить медиафайл. Попробуйте позже.',
      });
    },
    // Отключаем автоматические повторы, так как загрузка может занять много времени
    retry: false,
  });
}

