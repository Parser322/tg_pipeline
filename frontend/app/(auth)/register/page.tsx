import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import RegisterForm from './RegisterForm';
import { supabaseServer } from '@/lib/supabaseServer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RegisterFormState = {
  error?: string;
  message?: string;
};

async function registerAction(
  _prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  'use server';

  const username = (formData.get('username') as string | null)?.trim();
  const email = (formData.get('email') as string | null)?.trim();
  const password = formData.get('password') as string | null;
  const confirmPassword = formData.get('confirmPassword') as string | null;

  if (!username || !email || !password || !confirmPassword) {
    return { error: 'Заполните все поля' };
  }

  if (username.length < 2) {
    return { error: 'Имя пользователя должно содержать минимум 2 символа' };
  }

  if (password !== confirmPassword) {
    return { error: 'Пароли не совпадают' };
  }

  if (password.length < 6) {
    return { error: 'Пароль должен содержать минимум 6 символов' };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
        full_name: username,
        name: username,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Обновляем кеш после успешной регистрации
  revalidatePath('/', 'layout');

  return {
    message:
      'Регистрация прошла успешно. Проверьте почту для подтверждения аккаунта (если включено подтверждение email).',
  };
}

export default async function RegisterPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return (
    <div className='flex min-h-[calc(100vh-80px)] items-center justify-center'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle className='text-xl'>Регистрация</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <RegisterForm action={registerAction} />
          <p className='text-sm text-muted-foreground'>
            Уже есть аккаунт?{' '}
            <Link href='/login' className='text-primary hover:underline'>
              Войти
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
