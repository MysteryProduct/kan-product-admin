const DEFAULT_MS = 5_000;
const MAX_MS = 30_000;

/**
 * How long to wait before asking again after the API shed a request under load (503 with
 * `Retry-After` in seconds), or null when the failure is one that waiting will not change.
 */
export function retryAfterMs(error: unknown): number | null {
  const response = (error as { response?: { status?: number; headers?: Record<string, unknown> } })?.response;
  if (response?.status !== 503) return null;
  const seconds = Number(response.headers?.['retry-after']);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_MS;
  return Math.min(seconds * 1000, MAX_MS);
}
