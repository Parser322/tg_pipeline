'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Логируем ошибку в сервис мониторинга (например, Sentry)
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className='min-h-screen flex items-center justify-center p-4 bg-background'>
      <Card className='max-w-md w-full shadow-lg'>
        <CardHeader className='text-center'>
          <div className='flex justify-center mb-4'>
            <AlertCircle className='h-16 w-16 text-destructive' />
          </div>
          <CardTitle className='text-2xl'>Что-то пошло не так</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='text-center text-muted-foreground'>
            <p className='mb-2'>Произошла непредвиденная ошибка.</p>
            {error.digest && (
              <p className='text-sm font-mono bg-muted px-2 py-1 rounded'>
                Error ID: {error.digest}
              </p>
            )}
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <div className='p-3 bg-destructive/10 rounded-md border border-destructive/20'>
              <p className='text-xs font-semibold text-destructive mb-1'>
                Development Error Details:
              </p>
              <p className='text-xs text-destructive/80 font-mono break-all'>
                {error.message}
              </p>
            </div>
          )}

          <div className='flex gap-2'>
            <Button
              onClick={reset}
              className='flex-1'
              variant='default'
            >
              Попробовать снова
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              className='flex-1'
              variant='outline'
            >
              На главную
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

