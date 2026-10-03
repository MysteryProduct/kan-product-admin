import type { ReactNode } from 'react';

interface DocumentCodeProps {
  code: ReactNode;
  // The code before the TASK-0112 renumbering, from the API's legacy_code.
  legacyCode?: string | null;
  // The search the list was loaded with.
  search?: string;
}

/**
 * A document's code in a list. When the search matched the code the document
 * had before renumbering, that is said under it: an old number can now be
 * another document's code, and both come back from the search (ADR-0001).
 */
export default function DocumentCode({ code, legacyCode, search }: DocumentCodeProps) {
  const term = search?.trim().toLowerCase();
  const matchedLegacy = Boolean(term && legacyCode && legacyCode.toLowerCase().includes(term));
  return (
    <span className="block">
      <span className="block">{code}</span>
      {matchedLegacy && (
        <span className="mt-0.5 block text-[12px] text-[var(--ink-muted)]">ตรงกับเลขเดิม {legacyCode}</span>
      )}
    </span>
  );
}
