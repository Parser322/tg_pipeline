'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FormState = {
  error?: string;
};

const initialState: FormState = {};

type LoginFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

export default function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state?.error) {
      toast.error('Ошибка входа', { description: state.error });
    }
  }, [state?.error]);

  return (
    <form action={formAction} className='space-y-4'>
      <div className='space-y-2'>
        <label htmlFor='email' className='block text-sm font-medium text-foreground'>
          Email
        </label>
        <Input id='email' name='email' type='email' required autoComplete='email' />
      </div>

      <div className='space-y-2'>
        <label htmlFor='password' className='block text-sm font-medium text-foreground'>
          Пароль
        </label>
        <Input
          id='password'
          name='password'
          type='password'
          required
          minLength={6}
          autoComplete='current-password'
        />
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type='submit' className={cn('w-full')} disabled={pending}>
      {pending ? 'Входим…' : 'Войти'}
    </Button>
  );
}
