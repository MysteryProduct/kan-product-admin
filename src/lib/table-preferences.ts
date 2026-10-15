// Per-user, per-table column preferences kept in the browser only (TASK-0160).
// Storage can be missing, blocked or hold text from an older version, so every
// access is guarded and a bad value reads as "no preference".

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const VERSION = 1;

/** One key per table and employee, so two people on one browser never share a layout. */
export const preferenceKey = (table: string, userId: string | null | undefined) =>
  `ka:columns:${table}:${userId || 'anonymous'}`;

/** `window.localStorage`, or null when the browser refuses access to it. */
export function browserStorage(): PreferenceStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Hidden column keys. Unknown keys and the columns that must stay reachable
 * are dropped, so an old or edited value can never hide the product code,
 * name or the actions.
 */
export function loadHiddenColumns(
  storage: PreferenceStorage | null,
  key: string,
  allowed: readonly string[],
  required: readonly string[],
): string[] {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as { v?: unknown }).v !== VERSION ||
      !Array.isArray((parsed as { hidden?: unknown }).hidden)
    ) {
      return [];
    }
    const hidden = (parsed as { hidden: unknown[] }).hidden;
    return [...new Set(hidden)].filter(
      (column): column is string =>
        typeof column === 'string' && allowed.includes(column) && !required.includes(column),
    );
  } catch {
    return [];
  }
}

/** Returns false when the choice could not be stored (it still applies to this visit). */
export function saveHiddenColumns(storage: PreferenceStorage | null, key: string, hidden: readonly string[]): boolean {
  try {
    if (!storage) return false;
    if (hidden.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ v: VERSION, hidden }));
    return true;
  } catch {
    return false;
  }
}
