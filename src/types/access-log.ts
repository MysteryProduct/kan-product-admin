import { PaginationMeta } from './pagination';

export type AccessLogType = 'employee_license' | 'employee';

// One access change (TASK-0070). Names are the ones at the time of the change, so an
// entry for a deleted license still reads by the name it had.
export interface AccessLogEntry {
  id: string;
  created_at: string;
  type: AccessLogType;
  action: string;
  target_id: string;
  target_name: string | null;
  actor_id: string;
  actor_username: string | null;
  actor_name: string | null;
  previous_value: Record<string, unknown> | null;
  next_value: Record<string, unknown> | null;
}

export interface AccessLogResponse {
  data: AccessLogEntry[];
  meta: PaginationMeta;
}
