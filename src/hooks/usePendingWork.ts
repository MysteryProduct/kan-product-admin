'use client';

import { useEffect, useState } from 'react';
import { retryAfterMs } from '@/lib/retry-after';
import DashboardModel from '@/models/dashboard';
import type { PendingWork } from '@/types/dashboard';

const dashboardModel = new DashboardModel();
const REFRESH_MS = 5 * 60 * 1000;
const REFRESH_EVENT = 'ka-pending-work-changed';

// Callers mount and refresh together. The summary is the first thing admission control sheds
// when the database pool is busy, so everyone asking at the same moment shares one request. A
// request that began before the latest change cannot answer for it, so one more read follows it.
type Summary = ReturnType<DashboardModel['getSummary']>;
let changes = 0;
let inFlight: Summary | null = null;
let inFlightSeen = 0;
let queued: Summary | null = null;

function startRead(): Summary {
  inFlightSeen = changes;
  inFlight = dashboardModel.getSummary().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function readSummary(): Summary {
  if (!inFlight) return startRead();
  if (inFlightSeen === changes) return inFlight;
  queued ??= inFlight
    .catch(() => undefined)
    .then(() => {
      queued = null;
      return startRead();
    });
  return queued;
}

/** The menu, the header and a page each hold their own counts; this makes all of them read again. */
export function refreshPendingWork() {
  changes += 1;
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

/**
 * The counts of work waiting for the signed-in employee, for the menu badges.
 * A failed request leaves the badges out; it never blocks the menu.
 * `refreshPendingWork()` reads them again everywhere at once, for a page that changed that work.
 */
export function usePendingWork(enabled: boolean): PendingWork | undefined {
  const [work, setWork] = useState<PendingWork>();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let retry: number | undefined;
    let latest = 0;
    const load = (mayRetry = true) => {
      window.clearTimeout(retry);
      latest += 1;
      const mine = latest;
      readSummary()
        .then((summary) => {
          if (!cancelled && mine === latest) setWork(summary.pending_work);
        })
        .catch((error: unknown) => {
          if (cancelled || mine !== latest) return;
          // Shed under load: what is on screen stays while it asks once more when told to.
          const wait = mayRetry ? retryAfterMs(error) : null;
          if (wait === null) setWork(undefined);
          else retry = window.setTimeout(() => load(false), wait);
        });
    };
    const refresh = () => load();
    load();
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener(REFRESH_EVENT, refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(retry);
      window.removeEventListener(REFRESH_EVENT, refresh);
    };
  }, [enabled]);

  return work;
}
