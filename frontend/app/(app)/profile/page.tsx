import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LogoutButton from '@/components/LogoutButton';
import { getUserProfileServer } from '@/lib/userUtils';

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getUserProfileServer();
  const metadata = (user.user_metadata ?? {}) as {
    username?: string;
    full_name?: string;
    name?: string;
  };

  const displayName =
    metadata.username || metadata.full_name || metadata.name || user.email || 'User';
  const role = profile?.role ?? 'user';
  const roleLabel = role === 'admin' ? 'Администратор' : 'Пользователь';

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
            <div className='flex items-center gap-2'>
              <span className='font-medium'>Роль:</span>
              <Badge variant={role === 'admin' ? 'default' : 'secondary'}>{roleLabel}</Badge>
            </div>
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
