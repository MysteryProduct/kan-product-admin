'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// The purchase-order page shown before the current one in this tab, when the app moved there itself
// (a full page load starts over). The form uses it to step back to the detail page it came from.
let previous: string | null = null;
let current: string | null = null;

export function previousPath(): string | null {
  return previous;
}

/** Mounted by the purchase-orders layout, which stays while moving between its pages. */
export function PathMemory() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === current) return;
    previous = current;
    current = pathname;
  }, [pathname]);
  return null;
}
