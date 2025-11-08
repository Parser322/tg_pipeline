import React from 'react';
import { Progress } from './ui/progress';

type ProgressSectionProps = {
  processed: number;
  total: number;
};

const ProgressSection = ({ processed, total }: ProgressSectionProps) => {
  const progress = total > 0 ? (processed / total) * 100 : 0;

  return (
    <div className='space-y-2'>
      <div className='flex justify-between text-sm'>
        <span className='font-medium'>Прогресс</span>
        <span className='text-muted-foreground'>{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className='h-2 rounded-full' />
    </div>
  );
};

export { ProgressSection };



