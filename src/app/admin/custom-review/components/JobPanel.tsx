'use client';

import Link from 'next/link';
import { useState } from 'react';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import type { ReviewDetail } from '@/types/custom-review';

const JOB_LABEL: Record<string, string> = {
  pending: 'รอเริ่มผลิต',
  in_progress: 'กำลังผลิต',
  completed: 'ผลิตเสร็จแล้ว',
  cancelled: 'ยกเลิกแล้ว',
};

export type JobAct = 'create' | 'cancel';

/**
 * TASK-0211: what comes after approval. A request with the deposit paid gets
 * its Job Order here (made by the signed-in employee); the job can be given up
 * from here only before it starts. Once started it is followed on the job page.
 */
export default function JobPanel({
  detail,
  canCreate,
  canCancel,
  busy,
  onJob,
}: {
  detail: ReviewDetail;
  canCreate: boolean;
  canCancel: boolean;
  busy: JobAct | null;
  onJob: (act: JobAct, reason?: string) => Promise<boolean>;
}) {
  const [dialog, setDialog] = useState<JobAct | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState(false);
  const job = detail.jobOrder;
  const approvedHere = detail.status === 'approved_for_production';

  const close = () => {
    setDialog(null);
    setReason('');
    setReasonErr(false);
  };
  const confirmCancel = async () => {
    if (!reason.trim()) {
      setReasonErr(true);
      return;
    }
    if (await onJob('cancel', reason.trim())) close();
  };

  return (
    <div className="ka-cr-job" aria-label="งานผลิต">
      {job ? (
        <>
          <p className="ka-cr-job__l">
            <b>งานผลิต {job.code ?? ''}</b> · {JOB_LABEL[job.status ?? ''] ?? job.status}
            {' · '}
            <Link href="/admin/job-orders">เปิดหน้าใบผลิต</Link>
          </p>
          {job.status === 'pending' && approvedHere && canCancel && (
            <Button variant="ghost" onClick={() => setDialog('cancel')}>ยกเลิกงานผลิต</Button>
          )}
        </>
      ) : approvedHere ? (
        <>
          <p className="ka-cr-job__l">
            <b>ขั้นต่อไป: สร้างงานผลิต</b>
            {detail.depositCovered
              ? ' · รับมัดจำครบแล้ว ระบบจะจองวัตถุดิบตามแบบที่อนุมัติ'
              : ' · ยังรับมัดจำไม่ครบ สร้างงานผลิตไม่ได้'}
          </p>
          {canCreate ? (
            <Button variant="action" disabled={!detail.depositCovered} onClick={() => setDialog('create')}>
              สร้างงานผลิต
            </Button>
          ) : (
            <span className="ka-cr-cap">ไม่มีสิทธิ์สร้างงานผลิต</span>
          )}
        </>
      ) : null}

      <Modal
        isOpen={dialog === 'create'}
        onClose={() => {
          if (busy === null) close();
        }}
        title={`สร้างงานผลิตของ ${detail.code}?`}
        size="standard"
        closeOnBackdrop={busy === null}
        closeOnEscape={busy === null}
        className="ka-cr-dlg"
        footer={
          <>
            <Button onClick={close} disabled={busy !== null}>กลับ</Button>
            <Button
              variant="action"
              loading={busy === 'create'}
              onClick={async () => {
                if (await onJob('create')) close();
              }}
            >
              สร้างงานผลิต
            </Button>
          </>
        }
      >
        <p className="ka-cr-dlg__d">
          ระบบจะสร้างใบผลิตชนิด Custom จากแบบฉบับ {detail.approvedRevision ?? detail.revision} และ<b>จองวัตถุดิบทันที</b>{' '}
          ถ้าวัตถุดิบไม่พอจะไม่สร้างงานและไม่จองอะไร · ผู้รับงานคือคุณ
        </p>
      </Modal>

      <Modal
        isOpen={dialog === 'cancel'}
        onClose={() => {
          if (busy === null) close();
        }}
        title={`ยกเลิกงานผลิต ${job?.code ?? ''}?`}
        size="standard"
        closeOnBackdrop={busy === null}
        closeOnEscape={busy === null}
        className="ka-cr-dlg"
        footer={
          <>
            <Button onClick={close} disabled={busy !== null}>กลับ</Button>
            <Button variant="action" loading={busy === 'cancel'} onClick={confirmCancel}>ยกเลิกงานผลิต</Button>
          </>
        }
      >
        <p className="ka-cr-dlg__d">
          คืนวัตถุดิบที่จองไว้ และคำขอกลับไปรอสร้างงานผลิตใหม่ได้ · ยกเลิกได้เฉพาะงานที่ยังไม่เริ่มผลิต
        </p>
        <label htmlFor="ka-cr-job-reason">
          เหตุผล <span className="ka-cr-req" aria-hidden="true">*</span>
        </label>
        <textarea
          id="ka-cr-job-reason"
          className="ka-cr-in"
          maxLength={500}
          required
          aria-invalid={reasonErr || undefined}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonErr) setReasonErr(false);
          }}
        />
        {reasonErr && <span className="ka-cr-ferr">กรอกเหตุผลก่อนยกเลิก</span>}
      </Modal>
    </div>
  );
}
