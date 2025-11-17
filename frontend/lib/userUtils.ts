import { supabaseServer } from './supabaseServer';
import type { SupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

/**
 * Получает профиль пользователя с ролью
 */
export async function getUserProfile(supabase: SupabaseClient): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      userId: user.id,
    });

    // Если профиль не найден (PGRST116), пытаемся создать его
    if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
      console.warn('User profile not found, attempting to create:', user.id);

      // Пытаемся создать профиль с ролью по умолчанию
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({ id: user.id, role: 'user' })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        return null;
      }

      return newProfile as UserProfile;
    }

    return null;
  }

  if (!data) {
    return null;
  }

  return data as UserProfile;
}

/**
 * Получает роль текущего пользователя
 */
export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await supabaseServer();
  const profile = await getUserProfile(supabase);
  return profile?.role ?? null;
}

/**
 * Проверяет, является ли пользователь админом
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin';
}

/**
 * Проверяет, является ли пользователь обычным пользователем
 */
export async function isUser(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'user';
}

/**
 * Получает профиль пользователя на сервере
 */
export async function getUserProfileServer(): Promise<UserProfile | null> {
  const supabase = await supabaseServer();
  return getUserProfile(supabase);
}
