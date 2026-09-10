'use client';

import { useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, permissionMap } from '@/lib/permissions';
import type { PermissionAction } from '@/types/permission';

export function usePermissions() {
  const { permissions: items, isLoading } = useAuth();
  const permissions = useMemo(() => permissionMap(items), [items]);
  const can = useCallback(
    (menuName: string, action: PermissionAction = 'view') =>
      hasPermission(permissions, menuName, action),
    [permissions],
  );
  return { permissions, isLoaded: !isLoading, can };
}
