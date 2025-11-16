import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { supabaseServer } from '@/lib/supabaseServer';

type SettingsLayoutProps = {
  children: ReactNode;
};

export default async function SettingsLayout({ children }: SettingsLayoutProps) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return children;
}

