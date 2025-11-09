import React from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

type MessageAlertsProps = {
  error?: string | null;
  success?: string | null;
};

const MessageAlerts = ({ error, success }: MessageAlertsProps) => {
  if (!error && !success) return null;

  return (
    <div className='space-y-2' aria-live='polite' role='status'>
      {error && (
        <Alert className='border-red-200 bg-red-50' role='alert' aria-live='assertive'>
          <AlertCircle className='h-4 w-4 text-red-600' />
          <AlertDescription className='text-red-700'>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className='border-green-200 bg-green-50'>
          <CheckCircle className='h-4 w-4 text-green-600' />
          <AlertDescription className='text-green-700'>{success}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export { MessageAlerts };



