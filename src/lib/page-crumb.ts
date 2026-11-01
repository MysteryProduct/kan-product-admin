'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * A breadcrumb a page puts in the header instead of its menu name, e.g. "จัดซื้อ / ใบสั่งซื้อ"
 * or "← ใบสั่งซื้อ / PO202611010001". Pages that set none keep the plain page name.
 */
export interface PageCrumb {
  /** Link back to the parent page, drawn as "← {label}". */
  back?: { label: string; href: string };
  /** Plain steps before the current page, e.g. the menu group. */
  parents?: string[];
  current: string;
}

let current: PageCrumb | null = null;
const listeners = new Set<() => void>();

function setCrumb(next: PageCrumb | null) {
  current = next;
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** Shows `crumb` in the header while the calling page is mounted. */
export function usePageCrumb(crumb: PageCrumb | null) {
  const key = crumb ? JSON.stringify(crumb) : '';
  useEffect(() => {
    setCrumb(key ? (JSON.parse(key) as PageCrumb) : null);
    return () => setCrumb(null);
  }, [key]);
}

export function useCurrentCrumb(): PageCrumb | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
