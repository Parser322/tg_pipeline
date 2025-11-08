import React from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { UI_CONFIG } from '@/constants';

type StatusIndicatorProps = {
  isRunning: boolean;
  finished: boolean;
  processed: number;
  total: number;
};

const StatusIndicator = ({ isRunning, finished, processed, total }: StatusIndicatorProps) => {
  const getStatusIcon = () => {
    if (isRunning) {
      return <Loader2 className={`${UI_CONFIG.ICON_SIZE} animate-spin`} />;
    }
    if (finished) {
      return <CheckCircle className={`${UI_CONFIG.ICON_SIZE} text-green-500`} />;
    }
    return <AlertCircle className={`${UI_CONFIG.ICON_SIZE} text-blue-500`} />;
  };

  const getStatusText = () => {
    if (isRunning) {
      return `В процессе... Обработано ${processed} из ${total}`;
    }
    if (finished) {
      return `Завершено. Обработано ${processed} из ${total}`;
    }
    return 'Готов к запуску';
  };

  return (
    <div className='flex items-center gap-2 text-sm'>
      {getStatusIcon()}
      <span className='font-medium'>{getStatusText()}</span>
    </div>
  );
};

export default StatusIndicator;



