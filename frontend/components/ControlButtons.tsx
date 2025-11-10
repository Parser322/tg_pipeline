import { Button } from './ui/button';
import { Loader2, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

type ControlButtonsProps = {
  onRun: () => void;
  onStop: () => void;
  isRunning: boolean;
  disabled?: boolean;
  loading?: boolean;
};

export const ControlButtons = ({ onRun, onStop, isRunning, disabled, loading }: ControlButtonsProps) => {
  if (loading) {
    return (
      <Button
        disabled
        size='icon'
        variant={isRunning ? 'destructive' : 'default'}
        className={cn(
          'h-9 w-9',
          !isRunning && 'bg-green-500 text-white hover:bg-green-600'
        )}
        aria-label={isRunning ? 'Остановка...' : 'Запуск...'}
        title={isRunning ? 'Остановка...' : 'Запуск...'}
      >
        <Loader2 className='h-4 w-4 animate-spin' />
      </Button>
    );
  }

  if (isRunning) {
    return (
      <Button
        onClick={onStop}
        variant='destructive'
        size='icon'
        className='h-9 w-9'
        aria-label='Остановить парсер'
        title='Остановить'
      >
        <Square className='h-4 w-4' />
      </Button>
    );
  }

  return (
    <Button
      onClick={onRun}
      disabled={disabled}
      size='icon'
      variant='default'
      className='h-9 w-9 bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
      aria-label='Запустить парсер'
      title='Запустить'
    >
      <Play className='h-4 w-4' />
    </Button>
  );
};



