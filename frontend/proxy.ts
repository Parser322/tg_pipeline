import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Proxy для автоматического обновления сессий Supabase.
 *
 * Этот proxy:
 * 1. Обновляет истекшие токены авторизации
 * 2. Распространяет обновленную сессию на серверные компоненты и браузер
 * 3. Обеспечивает корректную работу аутентификации во всем приложении
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Обновление сессии пользователя, если необходимо
  // ВАЖНО: Не удаляйте этот вызов, даже если кажется, что он ничего не делает
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Обрабатываем все запросы, кроме:
     * - _next/static (статические файлы)
     * - _next/image (оптимизация изображений)
     * - favicon.ico (иконка сайта)
     * - файлы изображений (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

