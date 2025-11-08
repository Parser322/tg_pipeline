import React from 'react';
import { Button } from './ui/button';

type ControlButtonsProps = {
  onRun: () => void;
  onStop: () => void;
  isRunning: boolean;
  disabled?: boolean;
};

const ControlButtons = ({ onRun, onStop, isRunning, disabled }: ControlButtonsProps) => {
  if (isRunning) {
    return (
      <Button onClick={onStop} variant='outline' size='sm' className='border-input' aria-label='Остановить парсер' title='Остановить'>
        Остановить
      </Button>
    );
  }

  return (
    <Button
      onClick={onRun}
      disabled={disabled}
      size='sm'
      className='bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
      aria-label='Запустить парсер'
      title='Запустить'
    >
      Запустить
    </Button>
  );
};

export { ControlButtons };



