'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ToastOptions {
  message: string;
  tone?: 'success' | 'info' | 'danger';
  /** Both are needed for the button to show: only a caller that can really undo passes `onAction`. */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds on screen; 6 s, or 9 s when there is an action to reach. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

/** `const toast = useToast(); toast({ message: 'บันทึกแล้ว' })`. */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used within ToastProvider');
  return show;
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const hasAction = Boolean(item.actionLabel && item.onAction);
  const duration = item.duration ?? (hasAction ? 9000 : 6000);
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = window.setTimeout(() => doneRef.current(item.id), duration);
    return () => window.clearTimeout(timer);
  }, [item.id, duration]);

  return (
    <div className="ka-toast" data-tone={item.tone ?? 'success'}>
      <p className="ka-toast__text">{item.message}</p>
      {hasAction && (
        <button
          type="button"
          className="ka-toast__btn"
          onClick={() => {
            item.onAction?.();
            onDone(item.id);
          }}
        >
          {item.actionLabel}
        </button>
      )}
      <button type="button" className="ka-toast__btn ka-toast__btn--icon" aria-label="ปิดข้อความ" onClick={() => onDone(item.id)}>
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    // Three at most: a burst of saves must not bury the page.
    setItems((current) => [...current.slice(-2), { ...options, id }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="ka-toasts" role="status" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDone={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
