import type { ReactNode } from 'react';

export type BadgeTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral' | 'brand';

interface StatusBadgeProps {
  tone?: BadgeTone;
  /** A state that needs someone now; its dot pulses (stopped under reduced motion). */
  live?: boolean;
  className?: string;
  children: ReactNode;
}

/** A status word in a pill with a leading dot, so the state never rests on colour alone. */
export default function StatusBadge({ tone = 'neutral', live = false, className = '', children }: StatusBadgeProps) {
  const toneClass = tone === 'neutral' ? '' : `ka-badge--${tone}`;
  return <span className={`ka-badge ${toneClass} ${live ? 'ka-badge--live' : ''} ${className}`}>{children}</span>;
}
