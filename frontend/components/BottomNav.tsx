'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Newspaper, Settings } from 'lucide-react';
import { type ComponentType } from 'react';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Главная', icon: Home },
  { href: '/posts', label: 'Посты', icon: Newspaper },
  { href: '/settings', label: 'Настройки', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();
  
  return (
    <nav className='md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40'>
      <ul className='grid grid-cols-3 px-2 py-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]'>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <li key={href} className='flex'>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className='h-5 w-5' />
                <span className='hidden xs:inline'>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}


