'use client';

import { useState } from 'react';
import axiosInstance from '@/lib/axios';
import CancellationDialog from '@/components/CancellationDialog';

export default function DocumentCancellationAction({ endpoint, onSuccess }: {
  endpoint: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="my-2 min-h-11 rounded-lg bg-[var(--color-error)] px-4 py-2 font-medium text-white">ยกเลิกเอกสาร</button>
    {open && <CancellationDialog title="ยืนยันการยกเลิกเอกสาร" onClose={() => setOpen(false)} onConfirm={async reason => {
      await axiosInstance.post(endpoint, { reason });
      onSuccess();
    }} />}
  </>;
}
