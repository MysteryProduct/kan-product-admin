export interface PermissionItem {
  permission_id: number;
  permission_add: boolean;
  permission_edit: boolean;
  permission_delete: boolean;
  permission_view: boolean;
  permission_approve: boolean;
  permission_reject: boolean;
  menu: {
    menu_name: string;
  };
}

export type PermissionAction = 'add' | 'edit' | 'delete' | 'view' | 'approve' | 'reject';
