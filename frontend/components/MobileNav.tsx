'use client';
import Link from 'next/link';

export default function MobileNav() {
  return (
    <div className='flex items-center justify-between px-4 py-2'>
      <Link href='/' className='text-base font-semibold' aria-label='Главная'>
        Parser322
      </Link>
    </div>
  );
}
