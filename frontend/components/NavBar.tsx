'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

type NavItemProps = {
  href: string;
  label: string;
};

function NavItem({ href, label }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;
  const base = 'text-sm transition-colors block rounded-md px-3 py-2';
  const active = 'bg-accent text-foreground font-medium';
  const inactive = 'text-muted-foreground hover:text-foreground hover:bg-accent/50';
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`${base} ${isActive ? active : inactive}`}
    >
      {label}
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
        <NavItem href='/' label='Главная' />
        <NavItem href='/posts' label='Посты' />
      </nav>
    </div>
  );
}
