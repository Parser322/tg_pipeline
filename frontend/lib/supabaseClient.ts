import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/**
 * Клиент Supabase для использования в браузерных (client) компонентах.
 *
 * Важно:
 * - Ожидает переменные окружения NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * - Создаётся один раз на стороне клиента и переиспользуется.
 * - Использует современный пакет @supabase/ssr для управления сессиями.
 */
export function getSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY должны быть заданы в .env.local'
    );
  }

  browserClient = createBrowserClient(url, anonKey);

  return browserClient;
}

