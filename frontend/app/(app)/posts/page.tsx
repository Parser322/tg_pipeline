import { redirect } from 'next/navigation';
import PostsList from '@/components/PostsList';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function PostsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <PostsList />;
}

