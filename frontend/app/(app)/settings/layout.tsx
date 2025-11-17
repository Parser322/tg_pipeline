import type { ReactNode } from 'react';
import AdminOnly from '@/components/AdminOnly';

type SettingsLayoutProps = {
  children: ReactNode;
};

export default async function SettingsLayout({ children }: SettingsLayoutProps) {
  return <AdminOnly>{children}</AdminOnly>;
}

