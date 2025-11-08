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
  const base = 'text-sm transition-colors';
  const active = 'text-foreground';
  const inactive = 'text-muted-foreground hover:text-foreground';
  return (
    <Link href={href} aria-current={isActive ? 'page' : undefined} className={`${base} ${isActive ? active : inactive}`}>
      {label}
    </Link>
  );
}

export default function NavBar() {
  return (
    <header className='border-b'>
      <nav className='max-w-7xl mx-auto px-6 h-12 flex items-center gap-4'>
        <NavItem href='/' label='Главная' />
      </nav>
    </header>
  );
}



