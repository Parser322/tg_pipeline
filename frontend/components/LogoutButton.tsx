'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/lib/actions';

type LogoutFormState = {
  error?: string;
};

const initialState: LogoutFormState = {};

export default function LogoutButton() {
  const [state, formAction] = useActionState(logoutAction, initialState);
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className='space-y-2'>
      <Button type='submit' variant='outline' disabled={pending}>
        {pending ? 'Выходим…' : 'Выйти'}
      </Button>
      {state?.error && (
        <p className='text-sm font-medium text-destructive' role='alert'>
          {state.error}
        </p>
      )}
    </form>
  );
}

