'use client';
import { PipelineProvider } from '@/contexts/PipelineContext';
import { ToastProvider } from '@/contexts/ToastContext';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: true,
            staleTime: 30_000,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <PipelineProvider>
        <ToastProvider>{children}</ToastProvider>
      </PipelineProvider>
      {process.env.NODE_ENV !== 'production' ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}

