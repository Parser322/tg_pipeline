'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { Home, Newspaper } from 'lucide-react';

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: Item[] = [
  { href: '/', label: 'Главная', icon: Home },
  { href: '/posts', label: 'Посты', icon: Newspaper },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className='md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40'>
      <ul className='grid grid-cols-2 px-2 py-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]'>
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className='flex'>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition-colors ${
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
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


