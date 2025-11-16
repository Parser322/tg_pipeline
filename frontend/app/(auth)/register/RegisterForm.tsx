'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FormState = {
  error?: string;
  message?: string;
};

const initialState: FormState = {};

type RegisterFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
};

export default function RegisterForm({ action }: RegisterFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state?.error) {
      toast.error('Ошибка регистрации', { description: state.error });
    }
  }, [state?.error]);

  useEffect(() => {
    if (state?.message) {
      toast.success('Регистрация прошла успешно', { description: state.message });
    }
  }, [state?.message]);

  return (
    <form action={formAction} className='space-y-4'>
      <div className='space-y-2'>
        <label htmlFor='username' className='block text-sm font-medium text-foreground'>
          Имя пользователя
        </label>
        <Input
          id='username'
          name='username'
          type='text'
          required
          minLength={2}
          autoComplete='username'
          placeholder='Введите имя пользователя'
        />
      </div>

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
          autoComplete='new-password'
        />
      </div>

      <div className='space-y-2'>
        <label htmlFor='confirmPassword' className='block text-sm font-medium text-foreground'>
          Подтвердите пароль
        </label>
        <Input
          id='confirmPassword'
          name='confirmPassword'
          type='password'
          required
          minLength={6}
          autoComplete='new-password'
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
      {pending ? 'Регистрируем…' : 'Зарегистрироваться'}
    </Button>
  );
}
