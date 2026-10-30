'use client';

import type { ReactNode } from 'react';
import Modal from '@/components/Modal';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'standard' | 'wide';
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

/** A side panel for forms too long for a dialog. Below 640px it becomes a bottom sheet. */
export default function Drawer({ size = 'wide', ...props }: DrawerProps) {
  return <Modal {...props} size={size} placement="drawer" />;
}
