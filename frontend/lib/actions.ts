'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from './supabaseServer';

export type LogoutFormState = {
  error?: string;
};

export async function logoutAction(
  _prevState: LogoutFormState,
  _formData: FormData
): Promise<LogoutFormState> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  // Обновляем кеш после выхода
  revalidatePath('/', 'layout');
  redirect('/login');
}

