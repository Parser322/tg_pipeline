import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import LoginForm from './LoginForm';
import { supabaseServer } from '@/lib/supabaseServer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LoginFormState = {
  error?: string;
};

async function loginAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  'use server';

  const email = (formData.get('email') as string | null)?.trim();
  const password = formData.get('password') as string | null;

  if (!email || !password) {
    return { error: 'Введите email и пароль' };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Обновляем кеш и редиректим на главную
  revalidatePath('/', 'layout');
  redirect('/');
}

export default async function LoginPage() {
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
          <CardTitle className='text-xl'>Вход</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <LoginForm action={loginAction} />
          <p className='text-sm text-muted-foreground'>
            Нет аккаунта?{' '}
            <Link href='/register' className='text-primary hover:underline'>
              Зарегистрироваться
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
