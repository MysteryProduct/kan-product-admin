'use client';

import { useEffect, useState } from 'react';

/** The current time in ms, read when the component mounts and again every `intervalMs`, so a label such as "2 days ago" or "past the deadline" follows the clock. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
