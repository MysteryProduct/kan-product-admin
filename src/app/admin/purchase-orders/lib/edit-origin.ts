'use client';

// Whether the edit page was opened from its order's detail page. The answer is stored in the edit
// page's own history entry, so it holds after a reload or back/forward and never applies to an edit
// page opened another way (new tab, bookmark, typed address).
const KEY = 'kaPoEditFrom';
let pending: string | null = null;

/** Called by the detail page's "แก้ไข" link just before it navigates. */
export function markEditFromDetail(detailHref: string) {
  pending = detailHref;
}

/** Called once by the edit page after it opened: tags its history entry when the detail page opened it. */
export function claimEditOrigin(detailHref: string) {
  if (pending !== detailHref) return;
  pending = null;
  window.history.replaceState({ ...window.history.state, [KEY]: detailHref }, '', window.location.href);
}

/** Whether the current history entry is an edit page that `detailHref`'s detail page opened. */
export function openedFromDetail(detailHref: string): boolean {
  return (window.history.state as Record<string, unknown> | null)?.[KEY] === detailHref;
}
