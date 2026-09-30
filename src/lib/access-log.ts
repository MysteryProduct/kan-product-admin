import { PERMISSION_ACTION_LABELS } from '@/lib/permission-matrix';
import type { AccessLogEntry, AccessLogType } from '@/types/access-log';
import type { PermissionAction } from '@/types/permission';

export const ACCESS_LOG_TYPE_LABELS: Record<AccessLogType, string> = {
  employee_license: 'กลุ่มสิทธิ์',
  employee: 'พนักงาน',
};

const EVENT_LABELS: Record<AccessLogType, Record<string, string>> = {
  employee_license: {
    created: 'สร้างกลุ่มสิทธิ์',
    renamed: 'แก้ชื่อกลุ่มสิทธิ์',
    deleted: 'ลบกลุ่มสิทธิ์',
    permissions_updated: 'เปลี่ยนสิทธิ์รายเมนู',
  },
  employee: {
    created: 'เพิ่มพนักงาน',
    license_changed: 'ย้ายกลุ่มสิทธิ์',
    disabled: 'ปิดใช้งาน',
    enabled: 'เปิดใช้งาน',
  },
};

type MenuActions = { menu_id?: string; menu_name?: string; actions?: string[] };

const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
const licenseName = (value: Record<string, unknown> | null) =>
  text(value?.license_name) ?? 'กลุ่มที่ไม่พบชื่อ';
const menusOf = (value: Record<string, unknown> | null): MenuActions[] =>
  Array.isArray(value?.menus) ? (value.menus as MenuActions[]) : [];
const actionLabel = (action: string) =>
  PERMISSION_ACTION_LABELS[action as PermissionAction] ?? action;

/** "เมนู: เพิ่มสิทธิ์ ดู, แก้ไข / เอาสิทธิ์ ลบ ออก" for each menu whose actions changed. */
function describePermissionChanges(
  entry: AccessLogEntry,
  menuTitle: (menuName: string) => string,
): string[] {
  const before = new Map(menusOf(entry.previous_value).map((menu) => [menu.menu_id ?? menu.menu_name, menu]));
  return menusOf(entry.next_value).map((menu) => {
    const was = new Set(before.get(menu.menu_id ?? menu.menu_name)?.actions ?? []);
    const now = new Set(menu.actions ?? []);
    const added = [...now].filter((action) => !was.has(action)).map(actionLabel);
    const removed = [...was].filter((action) => !now.has(action)).map(actionLabel);
    const parts = [
      added.length ? `เพิ่มสิทธิ์ ${added.join(', ')}` : null,
      removed.length ? `เอาสิทธิ์ ${removed.join(', ')} ออก` : null,
    ].filter(Boolean);
    return `${menuTitle(menu.menu_name ?? '-')}: ${parts.join(' / ')}`;
  });
}

export interface AccessLogDescription {
  event: string;
  typeLabel: string;
  target: string;
  details: string[];
}

export function describeAccessLog(
  entry: AccessLogEntry,
  menuTitle: (menuName: string) => string = (name) => name,
): AccessLogDescription {
  const details = (() => {
    switch (`${entry.type}:${entry.action}`) {
      case 'employee_license:renamed':
        return [`"${licenseName(entry.previous_value)}" → "${licenseName(entry.next_value)}"`];
      case 'employee_license:permissions_updated':
        return describePermissionChanges(entry, menuTitle);
      case 'employee:created':
        return [`กลุ่มสิทธิ์: ${licenseName(entry.next_value)}`];
      case 'employee:license_changed':
        return [`${licenseName(entry.previous_value)} → ${licenseName(entry.next_value)}`];
      default:
        return [];
    }
  })();
  return {
    event: EVENT_LABELS[entry.type]?.[entry.action] ?? entry.action,
    typeLabel: ACCESS_LOG_TYPE_LABELS[entry.type] ?? entry.type,
    target: entry.target_name ?? entry.target_id,
    details,
  };
}
