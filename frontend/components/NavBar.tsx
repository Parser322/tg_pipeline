'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Newspaper } from 'lucide-react';
import { type ComponentType } from 'react';
import { cn } from '@/lib/utils';

type NavItemProps = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function NavItem({ href, label, icon: Icon }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'text-sm transition-colors flex items-center gap-2 rounded-md px-3 py-2',
        isActive
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      )}
    >
      <Icon className='h-4 w-4' />
      <span>{label}</span>
    </Link>
  );
}

export default function NavBar() {
  return (
    <div className='h-full p-4'>
      <div className='mb-4 px-3'>
        <Link href='/' className='text-base font-semibold'>
          Parser322
        </Link>
      </div>
      <nav className='flex flex-col gap-1'>
        <NavItem href='/' label='Главная' icon={Home} />
        <NavItem href='/posts' label='Посты' icon={Newspaper} />
      </nav>
    </div>
  );
}
