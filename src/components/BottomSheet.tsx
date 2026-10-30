'use client';

import type { ReactNode } from 'react';
import Modal from '@/components/Modal';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
}

/** A panel that rises from the bottom edge at every width. Menus and filters use it on phones. */
export default function BottomSheet(props: BottomSheetProps) {
  return <Modal {...props} size="compact" placement="sheet" />;
}
