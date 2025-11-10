'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { usePipeline } from '@/hooks/usePipeline';

type PipelineContextValue = ReturnType<typeof usePipeline>;

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const pipeline = usePipeline();
  // Не используем useMemo, так как pipeline - объект из хука с мемоизированными функциями
  return <PipelineContext.Provider value={pipeline}>{children}</PipelineContext.Provider>;
}

export function usePipelineContext(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) {
    throw new Error('usePipelineContext must be used within a PipelineProvider');
  }
  return ctx;
}



