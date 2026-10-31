'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import RowMenu from '@/components/RowMenu';
import ActionResultDialog from '@/components/ActionResultDialog';
import ChangePasswordModal from '@/components/layout/ChangePasswordModal';

/** The employee card at the foot of the sidebar; it opens the password and sign-out commands. */
export default function SidebarUser() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [passwordChanged, setPasswordChanged] = React.useState(false);
  const name = user?.employee_username || 'User';

  return (
    <div className="ka-sidebar__me">
      <RowMenu
        label={`บัญชี ${name}`}
        triggerClassName="ka-me"
        trigger={
          <>
            <span className="ka-me__avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
            <span className="ka-me__text">
              <strong>{name}</strong>
              <span>Admin</span>
            </span>
          </>
        }
        items={[
          { label: 'เปลี่ยนรหัสผ่าน', icon: 'key', onSelect: () => setPasswordOpen(true) },
          {
            label: 'ออกจากระบบ',
            icon: 'logout',
            onSelect: () => {
              logout();
              router.push('/login');
            },
          },
        ]}
      />
      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onChanged={() => {
          setPasswordOpen(false);
          setPasswordChanged(true);
        }}
      />
      <ActionResultDialog
        isOpen={passwordChanged}
        status="success"
        action="update"
        message="เปลี่ยนรหัสผ่านแล้ว เครื่องอื่นที่เข้าสู่ระบบค้างไว้ต้องเข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่"
        onClose={() => setPasswordChanged(false)}
      />
    </div>
  );
}
