import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Серверный клиент Supabase для использования в серверных компонентах и server actions.
 *
 * Использует куки Next.js App Router (cookies() из next/headers), чтобы читать/обновлять сессию.
 * Использует современный пакет @supabase/ssr для корректного управления сессиями.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY должны быть заданы в .env.local'
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Метод `setAll` был вызван из Server Component.
          // Это можно игнорировать, если у вас есть middleware,
          // обновляющий сессии пользователей.
        }
      },
    },
  });
}
