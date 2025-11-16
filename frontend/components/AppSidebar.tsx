'use client';

import * as React from 'react';
import { IconGauge, IconListDetails, IconSettings, IconInnerShadowTop } from '@tabler/icons-react';
import { usePathname } from 'next/navigation';

import { NavMain } from '@/components/NavMain';
import { NavUser } from '@/components/NavUser';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const data = React.useMemo(
    () => ({
      user: {
        name: 'User',
        email: 'user@example.com',
        avatar: '/avatars/shadcn.jpg',
      },
      navMain: [
        { title: 'Панель управления', url: '/', icon: IconGauge },
        { title: 'Посты', url: '/posts', icon: IconListDetails },
      ],
    }),
    []
  );

  return (
    <Sidebar collapsible='offcanvas' {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className='data-[slot=sidebar-menu-button]:!p-1.5'>
              <a href='/'>
                <IconInnerShadowTop className='!size-5' />
                <span className='text-base font-semibold'>Parser322</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <SidebarGroup className='mt-auto'>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip='Настройки'
                  isActive={pathname === '/settings' || pathname.startsWith('/settings/')}
                >
                  <a href='/settings' aria-current={pathname === '/settings' ? 'page' : undefined}>
                    <IconSettings />
                    <span>Настройки</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
