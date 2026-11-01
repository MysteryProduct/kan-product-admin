'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { previousPath } from '../lib/previous-path';

/**
 * Asks before leaving a page with unsaved edits: through the page's own cancel, any in-app link
 * (header crumb, sidebar), the browser's back button, or closing the tab.
 */
export function useLeaveGuard(active: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | 'back' | null>(null);
  const activeRef = useRef(active);
  const releasedRef = useRef(false);
  const trappedRef = useRef(false);
  useEffect(() => {
    activeRef.current = active && !releasedRef.current;
  }, [active]);

  // Closing or reloading the tab: the browser's own prompt.
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!activeRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);

  // In-app links are caught before Next.js handles the click.
  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      if (!activeRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active]);

  // The back button: an extra history entry for this page takes the first "back", and we ask.
  useEffect(() => {
    if (!active) return;
    if (!trappedRef.current) {
      window.history.pushState({ ...window.history.state, kaLeaveGuard: true }, '', window.location.href);
      trappedRef.current = true;
    }
    const onPop = () => {
      if (!activeRef.current) return;
      window.history.pushState({ ...window.history.state, kaLeaveGuard: true }, '', window.location.href);
      setTarget('back');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [active]);

  const go = useCallback(
    (next: string | 'back') => {
      releasedRef.current = true;
      activeRef.current = false;
      setTarget(null);
      if (next === 'back') {
        // Skip the extra entry as well as this page.
        window.history.go(trappedRef.current ? -2 : -1);
      } else {
        router.push(next);
      }
    },
    [router],
  );

  /** Leave now if nothing is unsaved, otherwise ask first. */
  const leave = useCallback(
    (href: string) => {
      if (activeRef.current) setTarget(href);
      else go(href);
    },
    [go],
  );

  return {
    asking: target !== null,
    leave,
    stay: () => setTarget(null),
    confirm: () => target && go(target),
    /**
     * After a save: go to `href` without asking. The extra back-button entry is stepped over first (it
     * belongs to this page, so that step never leaves the app). When the form was opened from `href`
     * itself (edit from the order's detail), that entry is reused instead of stacking a second copy;
     * otherwise `href` takes the form's place, so back reaches the page before the form.
     */
    replaceWith: (href: string) => {
      releasedRef.current = true;
      activeRef.current = false;
      const cameFromHref = previousPath() === href;
      const finish = () => {
        if (cameFromHref) window.history.back();
        else router.replace(href);
      };
      if (!trappedRef.current) {
        finish();
        return;
      }
      trappedRef.current = false;
      window.addEventListener('popstate', finish, { once: true });
      window.history.back();
    },
  };
}
