/**
 * Lets only the most recent request of a kind apply its result. A slower,
 * older response arrives after a newer query was sent and must not replace it
 * (TASK-0160 R1).
 */
export function createLatestGate() {
  let latest = 0;
  return {
    /** Call when a request starts; keep the returned ticket. */
    begin(): number {
      latest += 1;
      return latest;
    },
    /** Whether no newer request has started since the ticket was issued. */
    isLatest(ticket: number): boolean {
      return ticket === latest;
    },
  };
}
