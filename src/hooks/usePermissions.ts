'use client';

import { useEffect, useMemo, useState } from 'react';
import { PermissionAction, PermissionItem } from '@/types/permission';

type PermissionMap = Map<string, PermissionItem>;

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionMap>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedPermissions = localStorage.getItem('permissions');

    if (!storedPermissions) {
      setPermissions(new Map());
      setIsLoaded(true);
      return;
    }

    try {
      const parsed: PermissionItem[] = JSON.parse(storedPermissions);
      const map = new Map(parsed.map((permission) => [permission.menu?.menu_name, permission]));
      setPermissions(map);
    } catch (error) {
      console.error('Failed to parse stored permissions:', error);
      localStorage.removeItem('permissions');
      setPermissions(new Map());
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const can = useMemo(
    () => (menuName: string, action: PermissionAction = 'view'): boolean => {
      const permission = permissions.get(menuName);

      if (!permission) {
        return false;
      }

      switch (action) {
        case 'add':
          return permission.permission_add;
        case 'edit':
          return permission.permission_edit;
        case 'delete':
          return permission.permission_delete;
        case 'approve':
          return permission.permission_approve;
        case 'reject':
          return permission.permission_reject;
        case 'view':
        default:
          return permission.permission_view;
      }
    },
    [permissions]
  );

  return {
    permissions,
    isLoaded,
    can,
  };
}
