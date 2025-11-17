import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/userUtils';
import type { ReactNode } from 'react';

interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Компонент для защиты контента, доступного только администраторам.
 * Если пользователь не является админом, выполняется редирект или показывается fallback.
 */
export default async function AdminOnly({ children, fallback }: AdminOnlyProps) {
  const userIsAdmin = await isAdmin();

  if (!userIsAdmin) {
    if (fallback) {
      return <>{fallback}</>;
    }
    redirect('/');
  }

  return <>{children}</>;
}

