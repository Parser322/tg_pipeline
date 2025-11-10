import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

type ProgressStatus = {
  is_running: boolean;
  processed: number;
  total: number;
};

export const useProgressToast = (status: ProgressStatus) => {
  const progressToastIdRef = useRef<string | null>(null);
  const prevIsRunningRef = useRef(status.is_running);
  const updateProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prevIsRunning = prevIsRunningRef.current;
    const currentIsRunning = status.is_running;
    const hasProgress = status.total > 0;

    // Начало: создаем тост прогресса
    if (currentIsRunning && !prevIsRunning && hasProgress) {
      const id = 'pipeline-progress';
      progressToastIdRef.current = id;
      const pct = Math.max(0, Math.min(100, Math.round((status.processed / status.total) * 100)));
      toast(`${status.processed} из ${status.total} · ${pct}%`, {
        id,
        duration: Infinity,
        description: <Progress value={pct} className='w-full h-2 mt-1' />,
      });
    }

    // Обновление прогресса
    if (currentIsRunning && hasProgress && progressToastIdRef.current) {
      if (updateProgressTimeoutRef.current) {
        clearTimeout(updateProgressTimeoutRef.current);
      }

      updateProgressTimeoutRef.current = setTimeout(() => {
        if (progressToastIdRef.current) {
          const id = progressToastIdRef.current;
          const { processed, total } = status;
          const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((processed / total) * 100))) : 0;
          toast(`${processed} из ${total} · ${pct}%`, {
            id,
            duration: Infinity,
            description: <Progress value={pct} className='w-full h-2 mt-1' />,
          });
        }
      }, 300);
    }

    // Отображаем тост если его еще нет, но должен быть
    if (currentIsRunning && hasProgress && !progressToastIdRef.current) {
      const id = 'pipeline-progress';
      progressToastIdRef.current = id;
      const { processed, total } = status;
      const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((processed / total) * 100))) : 0;
      toast(`${processed} из ${total} · ${pct}%`, {
        id,
        duration: Infinity,
        description: <Progress value={pct} className='w-full h-2 mt-1' />,
      });
    }

    // Завершение: удаляем тост прогресса
    if (!currentIsRunning && prevIsRunning && progressToastIdRef.current) {
      if (updateProgressTimeoutRef.current) {
        clearTimeout(updateProgressTimeoutRef.current);
        updateProgressTimeoutRef.current = null;
      }

      const id = progressToastIdRef.current;
      if (id) {
        toast.dismiss(id);
      }
      progressToastIdRef.current = null;
    }

    prevIsRunningRef.current = currentIsRunning;

    return () => {
      if (updateProgressTimeoutRef.current) {
        clearTimeout(updateProgressTimeoutRef.current);
      }
    };
  }, [status.is_running, status.processed, status.total]);
};

