import './globals.css';
import Providers from './providers';
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
