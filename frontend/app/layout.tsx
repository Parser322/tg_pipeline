import './globals.css';
import Providers from './providers';
import { AppSidebar } from '@/components/AppSidebar';
import { SiteHeader } from '@/components/SiteHeader';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import type { Metadata, Viewport } from 'next';
import type { ReactNode, CSSProperties } from 'react';

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
          <SidebarProvider
            style={
              {
                // Фикс: задаём валидные значения CSS-переменных,
                // чтобы контент не заезжал под левый сайдбар
                '--sidebar-width': '18rem',
                '--header-height': '48px',
              } as CSSProperties
            }
          >
            <AppSidebar variant='inset' />
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
        </Providers>
      </body>
    </html>
  );
}
