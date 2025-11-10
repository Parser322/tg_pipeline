import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-background'>
      <div className='flex flex-col items-center gap-4'>
        <Loader2 className='h-12 w-12 animate-spin text-primary' />
        <p className='text-muted-foreground text-sm font-medium'>
          Загрузка...
        </p>
      </div>
    </div>
  );
}

