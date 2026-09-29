import type { PermissionAction } from '@/types/permission';
import type {
  MenuPermissionRow,
  PermissionFlags,
  SaveLicensePermissionsDto,
} from '@/types/employee-license';

export const PERMISSION_ACTIONS: PermissionAction[] = ['view', 'add', 'edit', 'delete', 'approve', 'reject'];

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'ดู',
  add: 'เพิ่ม',
  edit: 'แก้ไข',
  delete: 'ลบ',
  approve: 'อนุมัติ',
  reject: 'ไม่อนุมัติ',
};

// Ticked actions per menu_id, edited locally until the single save.
export type PermissionDraft = Record<string, PermissionFlags>;
export type SelectionState = 'all' | 'some' | 'none';

const field = (action: PermissionAction) => `permission_${action}` as const;

const flagsOf = (source: Partial<PermissionFlags> | undefined): PermissionFlags =>
  Object.fromEntries(PERMISSION_ACTIONS.map((action) => [field(action), source?.[field(action)] === true])) as PermissionFlags;

export function draftFromMenus(menus: MenuPermissionRow[]): PermissionDraft {
  return Object.fromEntries(menus.map((menu) => [menu.menu_id, flagsOf(menu)]));
}

export function toggleCell(draft: PermissionDraft, menuId: string, action: PermissionAction): PermissionDraft {
  const flags = flagsOf(draft[menuId]);
  return { ...draft, [menuId]: { ...flags, [field(action)]: !flags[field(action)] } };
}

export function setRow(draft: PermissionDraft, menuId: string, value: boolean): PermissionDraft {
  return {
    ...draft,
    [menuId]: Object.fromEntries(PERMISSION_ACTIONS.map((action) => [field(action), value])) as PermissionFlags,
  };
}

export function setColumn(
  draft: PermissionDraft,
  action: PermissionAction,
  value: boolean,
  menuIds: string[] = Object.keys(draft),
): PermissionDraft {
  const next = { ...draft };
  for (const menuId of menuIds) next[menuId] = { ...flagsOf(draft[menuId]), [field(action)]: value };
  return next;
}

const stateOf = (values: boolean[]): SelectionState => {
  const ticked = values.filter(Boolean).length;
  if (ticked === 0) return 'none';
  return ticked === values.length ? 'all' : 'some';
};

export function rowState(draft: PermissionDraft, menuId: string): SelectionState {
  const flags = flagsOf(draft[menuId]);
  return stateOf(PERMISSION_ACTIONS.map((action) => flags[field(action)]));
}

export function columnState(
  draft: PermissionDraft,
  action: PermissionAction,
  menuIds: string[] = Object.keys(draft),
): SelectionState {
  if (menuIds.length === 0) return 'none';
  return stateOf(menuIds.map((menuId) => flagsOf(draft[menuId])[field(action)]));
}

/** Menus whose ticks differ from what was loaded. */
export function changedMenuIds(original: PermissionDraft, draft: PermissionDraft): string[] {
  const ids = new Set([...Object.keys(original), ...Object.keys(draft)]);
  return [...ids].filter((menuId) => {
    const before = flagsOf(original[menuId]);
    const after = flagsOf(draft[menuId]);
    return PERMISSION_ACTIONS.some((action) => before[field(action)] !== after[field(action)]);
  });
}

export function toSavePayload(draft: PermissionDraft): SaveLicensePermissionsDto {
  return {
    permissions: Object.entries(draft).map(([menu_id, flags]) => ({ menu_id, ...flagsOf(flags) })),
  };
}

/** Consecutive menus of one menu_group, in the order the API sent them. */
export function groupMenus(menus: MenuPermissionRow[]): { group: string; menus: MenuPermissionRow[] }[] {
  const groups: { group: string; menus: MenuPermissionRow[] }[] = [];
  for (const menu of menus) {
    const last = groups[groups.length - 1];
    if (last && last.group === menu.menu_group) last.menus.push(menu);
    else groups.push({ group: menu.menu_group, menus: [menu] });
  }
  return groups;
}
