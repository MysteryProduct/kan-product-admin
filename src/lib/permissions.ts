import type { PermissionAction, PermissionItem } from '@/types/permission';

export function permissionMap(
  items: PermissionItem[],
): Map<string, PermissionItem> {
  return new Map(
    items
      .filter((item) => typeof item?.menu?.menu_name === 'string')
      .map((item) => [item.menu.menu_name.toLowerCase(), item]),
  );
}

export function hasPermission(
  permissions: Map<string, PermissionItem>,
  menu: string,
  action: PermissionAction = 'view',
): boolean {
  return permissions.get(menu.toLowerCase())?.[`permission_${action}`] === true;
}
