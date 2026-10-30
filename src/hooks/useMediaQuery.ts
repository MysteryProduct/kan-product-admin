'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query matches now. The server and the first paint answer false. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below 640px the admin turns menus, filters and dialogs into bottom sheets. */
export const useIsPhone = () => useMediaQuery('(max-width: 639px)');
