'use client';
import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { Progress } from '@/components/ui/progress';

export interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  scope?: string; // e.g., 'notifications' | 'default'
  progress?: {
    processed: number;
    total: number;
  };
  duration?: number;
}

type ToastContextValue = {
  toasts: ToastData[];
  showToast: (toast: Omit<ToastData, 'id'>) => string;
  updateToast: (id: string, toast: Partial<Omit<ToastData, 'id'>>) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timeoutRefs = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  const showToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastData = { scope: 'default', variant: 'default', ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timeoutRefs.current.delete(id);
      }, duration);
      timeoutRefs.current.set(id, timeoutId);
    }

    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<ToastData, 'id'>>) => {
    setToasts((prev) => {
      const existingToast = prev.find((t) => t.id === id);
      if (!existingToast) return prev;

      const existingTimeout = timeoutRefs.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        timeoutRefs.current.delete(id);
      }

      const newDuration =
        updates.duration !== undefined ? updates.duration : existingToast.duration;
      if (newDuration !== undefined && newDuration > 0) {
        const timeoutId = setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
          timeoutRefs.current.delete(id);
        }, newDuration);
        timeoutRefs.current.set(id, timeoutId);
      }

      return prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, updateToast, dismissToast }}>
      {children}
      {/* notifications scope: fixed bottom-right */}
      <ToastContainer
        toasts={toasts.filter((t) => (t.scope ?? 'default') === 'notifications')}
        onDismiss={dismissToast}
        positionClass='fixed bottom-4 right-4'
      />
      {/* default scope (progress/прочее): slightly above notifications to avoid overlap */}
      <ToastContainer
        toasts={toasts.filter((t) => (t.scope ?? 'default') !== 'notifications')}
        onDismiss={dismissToast}
        positionClass='fixed bottom-28 right-4'
      />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
  positionClass,
}: {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  positionClass?: string;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className={`${positionClass ?? 'fixed bottom-4 right-4'} z-[100] flex flex-col-reverse gap-2 w-full max-w-[420px] pointer-events-none`}>
      {toasts.map((toast) => {
        const progress = toast.progress
          ? (toast.progress.processed / toast.progress.total) * 100
          : undefined;

        return (
          <Toast key={toast.id} onClose={() => onDismiss(toast.id)} className='pointer-events-auto' variant={toast.variant}>
            <div className='w-full space-y-2'>
              {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
              {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
              {toast.progress && (
                <div className='space-y-1'>
                  <div className='flex justify-between text-xs text-muted-foreground'>
                    <span>
                      {toast.progress.processed} из {toast.progress.total}
                    </span>
                    <span>{Math.round(progress || 0)}%</span>
                  </div>
                  <Progress value={progress} className='h-2' />
                </div>
              )}
            </div>
          </Toast>
        );
      })}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
