'use client';
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePipeline } from '@/hooks/usePipeline';

type PipelineContextValue = ReturnType<typeof usePipeline>;

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const pipeline = usePipeline();
  const value = useMemo(() => pipeline, [pipeline]);
  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipelineContext(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) {
    throw new Error('usePipelineContext must be used within a PipelineProvider');
  }
  return ctx;
}



