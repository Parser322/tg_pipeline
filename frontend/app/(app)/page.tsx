import { redirect } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function Page() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <Dashboard />;
}

