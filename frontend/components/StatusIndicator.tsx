import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { UI_CONFIG } from '@/constants';
import { useMemo } from 'react';

type StatusIndicatorProps = {
  isRunning: boolean;
  finished: boolean;
  processed: number;
  total: number;
};

export default function StatusIndicator({ isRunning, finished, processed, total }: StatusIndicatorProps) {
  const statusIcon = useMemo(() => {
    if (isRunning) {
      return <Loader2 className={`${UI_CONFIG.ICON_SIZE} animate-spin`} />;
    }
    if (finished) {
      return <CheckCircle className={`${UI_CONFIG.ICON_SIZE} text-green-500`} />;
    }
    return <AlertCircle className={`${UI_CONFIG.ICON_SIZE} text-blue-500`} />;
  }, [isRunning, finished]);

  const statusText = useMemo(() => {
    if (isRunning) {
      return `В процессе · ${processed}/${total}`;
    }
    if (finished) {
      return `Завершено · ${processed}/${total}`;
    }
    return 'Готов';
  }, [isRunning, finished, processed, total]);

  return (
    <div className='flex items-center gap-2 text-sm' role='status' aria-live='polite'>
      {statusIcon}
      <span className='font-medium'>{statusText}</span>
    </div>
  );
}



