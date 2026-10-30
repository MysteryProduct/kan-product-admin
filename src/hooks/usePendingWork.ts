'use client';

import { useEffect, useState } from 'react';
import DashboardModel from '@/models/dashboard';
import type { PendingWork } from '@/types/dashboard';

const dashboardModel = new DashboardModel();
const REFRESH_MS = 5 * 60 * 1000;

/**
 * The counts of work waiting for the signed-in employee, for the menu badges.
 * A failed request leaves the badges out; it never blocks the menu.
 */
export function usePendingWork(enabled: boolean): PendingWork | undefined {
  const [work, setWork] = useState<PendingWork>();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      dashboardModel
        .getSummary()
        .then((summary) => {
          if (!cancelled) setWork(summary.pending_work);
        })
        .catch(() => {
          if (!cancelled) setWork(undefined);
        });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return work;
}
