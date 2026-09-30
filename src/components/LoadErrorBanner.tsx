interface LoadErrorBannerProps {
  // Thai text saying what did not load; nothing is drawn while it is empty.
  message: string | null;
  // When given, a "try again" action re-runs the load that failed; without it the text asks for a refresh.
  onRetry?: () => void;
  className?: string;
}

/** What failed and why, in one sentence: "โหลด{what}ไม่สำเร็จ: {reason}". */
export function loadErrorText(what: string, error: unknown): string {
  const reason = error instanceof Error && error.message ? error.message : 'กรุณาลองใหม่';
  return `โหลด${what}ไม่สำเร็จ: ${reason}`;
}

/** The labels whose request was rejected, so a form can say which of its lists is missing. */
export function failedLabels(results: PromiseSettledResult<unknown>[], labels: string[]): string[] {
  return labels.filter((_, index) => results[index]?.status === 'rejected');
}

/** "โหลดรายการ…ไม่สำเร็จ" for the lists in `failed`, or null when every list loaded. */
export function partialLoadText(failed: string[]): string | null {
  return failed.length > 0 ? `โหลดรายการ${failed.join(', ')}ไม่สำเร็จ` : null;
}

/**
 * Shown when a list or a form's choices could not be loaded, so an empty table or an empty
 * dropdown is never mistaken for "no data". The data already on screen is left as it was.
 */
export default function LoadErrorBanner({ message, onRetry, className = '' }: LoadErrorBannerProps) {
  if (!message) return null;
  return (
    <div role="alert" className={`ka-banner ka-banner--danger whitespace-pre-line ${className}`}>
      <span>
        {message}
        {onRetry ? (
          <>
            {' '}
            <button type="button" className="font-semibold underline" onClick={onRetry}>
              ลองอีกครั้ง
            </button>
          </>
        ) : (
          ' กรุณารีเฟรชหน้านี้เพื่อลองใหม่'
        )}
      </span>
    </div>
  );
}
