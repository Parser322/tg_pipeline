import { AppSidebar } from '@/components/AppSidebar';
import { SiteHeader } from '@/components/SiteHeader';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { supabaseServer } from '@/lib/supabaseServer';
import type { ReactNode, CSSProperties } from 'react';

type AppLayoutProps = {
  children: ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const metadata = (user?.user_metadata ?? {}) as {
    username?: string;
    full_name?: string;
    name?: string;
  };

  const sidebarUser = user
    ? {
        name: metadata.username || metadata.full_name || metadata.name || user.email || 'User',
        email: user.email || '',
        avatar: '/avatars/shadcn.jpg',
      }
    : null;

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '18rem',
          '--header-height': '48px',
        } as CSSProperties
      }
    >
      <AppSidebar variant='inset' user={sidebarUser} />
      <SidebarInset>
        <SiteHeader />
        <Separator />
        <div className='flex flex-1 flex-col'>
          <div className='@container/main flex flex-1 flex-col gap-2'>
            <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6'>
              <div className='px-4 lg:px-6'>{children}</div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

