'use client';
import { PipelineProvider } from '@/contexts/PipelineContext';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return <PipelineProvider>{children}</PipelineProvider>;
}


