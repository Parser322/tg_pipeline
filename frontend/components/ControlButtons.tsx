import React from 'react';
import { Button } from './ui/button';
import { Loader2, Play, Square } from 'lucide-react';

type ControlButtonsProps = {
  onRun: () => void;
  onStop: () => void;
  isRunning: boolean;
  disabled?: boolean;
  loading?: boolean;
};

const ControlButtons = ({ onRun, onStop, isRunning, disabled, loading }: ControlButtonsProps) => {
  if (loading) {
    return (
      <Button
        disabled
        size='icon'
        variant={isRunning ? 'outline' : 'secondary'}
        className='h-9 w-9'
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
        variant='outline'
        size='icon'
        className='border-input h-9 w-9'
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
      variant='secondary'
      className='h-9 w-9 disabled:opacity-50 disabled:cursor-not-allowed'
      aria-label='Запустить парсер'
      title='Запустить'
    >
      <Play className='h-4 w-4' />
    </Button>
  );
};

export { ControlButtons };



