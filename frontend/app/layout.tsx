import './globals.css';
import Providers from './providers';
import NavBar from '@/components/NavBar';
import MobileNav from '@/components/MobileNav';
import BottomNav from '@/components/BottomNav';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: {
    default: 'Parser322',
    template: '%s | Parser322',
  },
  description: 'Интерфейс управления пайплайном парсинга и инструментами OCR/перевода.',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Parser322',
    description: 'Парсер и инструменты для OCR, перевода и экспериментов с GPT.',
    url: '/',
    siteName: 'Parser322',
    locale: 'ru_RU',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='ru'>
      <body>
        <Providers>
          <div className='min-h-screen flex flex-col'>
            <header className='md:hidden border-b'>
              <MobileNav />
            </header>
            <div className='flex flex-1'>
              <aside className='hidden md:block w-64 border-r'>
              <NavBar />
              </aside>
              <main className='flex-1'>
                <div className='max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 pb-20 md:pb-6'>{children}</div>
              </main>
            </div>
            <footer className='md:hidden'>
              <BottomNav />
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
