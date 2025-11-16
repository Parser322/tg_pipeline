import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LogoutButton from '@/components/LogoutButton';

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const metadata = (user.user_metadata ?? {}) as {
    username?: string;
    full_name?: string;
    name?: string;
  };

  const displayName = metadata.username || metadata.full_name || metadata.name || user.email || 'User';

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Профиль пользователя</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <p>
              <span className='font-medium'>Имя пользователя:</span> {displayName}
            </p>
            <p>
              <span className='font-medium'>Email:</span> {user.email}
            </p>
            <p>
              <span className='font-medium'>ID:</span> {user.id}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Действия</CardTitle>
        </CardHeader>
        <CardContent>
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}

