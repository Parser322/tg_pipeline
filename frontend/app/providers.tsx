'use client';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useMemo } from 'react';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: true,
            staleTime: 30_000,
            gcTime: 5 * 60 * 1000,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  const isDevelopment = useMemo(() => process.env.NODE_ENV !== 'production', []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position='bottom-right'
        duration={5000}
        visibleToasts={3}
        closeButton
        toastOptions={{
          className: 'w-[380px]',
          descriptionClassName: 'block w-full col-span-full',
        }}
      />
      {isDevelopment && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

