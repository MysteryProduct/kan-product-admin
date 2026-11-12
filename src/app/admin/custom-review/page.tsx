'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Button from '@/components/Button';
import { useToast } from '@/components/Toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useCompactSidebar } from '@/contexts/SidebarContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { customReviewModel } from '@/models/custom-review';
import type { ReviewDetail } from '@/types/custom-review';
import QueueRail from './components/QueueRail';
import ReviewWorkspace, { type ReviewAct } from './components/ReviewWorkspace';
import { useReviewQueue } from './use-review-queue';
import './custom-review.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DONE: Record<ReviewAct, (revision: number) => string> = {
  received: () => 'บันทึกว่าได้รับไฟล์แล้ว · สถานะเป็นกำลังตรวจ',
  needs_changes: () => 'บันทึกขอให้แก้แล้ว · แจ้งรายละเอียดลูกค้าในแชท LINE',
  approved: (revision) => `อนุมัติแบบฉบับ ${revision} ให้ผลิตแล้ว`,
};

/** Shown in the approve dialog for a 409: someone else changed the record first. */
const CONFLICT = 'สถานะคำขอนี้เปลี่ยนไปแล้ว อาจมีพนักงานอื่นบันทึกผลก่อน';

function CustomReviewPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawId = params.get('id');
  const id = rawId && UUID.test(rawId) ? rawId : null;
  const wide = useMediaQuery('(min-width: 1024px)');
  const { can } = usePermissions();
  const toast = useToast();
  const queue = useReviewQueue();
  useCompactSidebar();

  const [detailTick, setDetailTick] = useState(0);
  const detailKey = `${id}|${detailTick}`;
  const [loaded, setLoaded] = useState<{ key: string; detail: ReviewDetail | null; error: string | null }>({
    key: '',
    detail: null,
    error: null,
  });
  // The record on screen is the selected one; a reload of it keeps it visible until the answer.
  const detail = id && loaded.detail?.requestId === id ? loaded.detail : null;
  const detailError = loaded.key === detailKey ? loaded.error : null;
  // The selection when a write answers, which may differ from the one it was sent for.
  const selectedId = useRef(id);
  useEffect(() => {
    selectedId.current = id;
  }, [id]);
  // Writes in flight, by request: the buttons of one request never show another one's write.
  const [pending, setPending] = useState<Record<string, ReviewAct>>({});
  const [conflict, setConflict] = useState<string | null>(null);

  const hrefFor = useCallback((rowId: string) => `${pathname}?id=${rowId}`, [pathname]);

  // On a wide screen the workspace is never empty: open the oldest request in the list.
  const firstId = queue.data?.data[0]?.id;
  useEffect(() => {
    if (wide && !id && firstId) router.replace(hrefFor(firstId), { scroll: false });
  }, [wide, id, firstId, hrefFor, router]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    customReviewModel
      .detail(id, controller.signal)
      .then((d) => {
        if (!controller.signal.aborted) setLoaded({ key: detailKey, detail: d, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        const error =
          axios.isAxiosError(err) && err.response?.status === 404 ? 'ไม่พบคำขอนี้' : `โหลดคำขอไม่สำเร็จ ${getApiErrorMessage(err)}`;
        setLoaded((prev) => ({ key: detailKey, detail: prev.detail?.requestId === id ? prev.detail : null, error }));
      });
    return () => controller.abort();
  }, [id, detailKey]);

  const reloadQueue = queue.reload;
  const reloadDetail = useCallback(() => {
    setConflict(null);
    setDetailTick((n) => n + 1);
    reloadQueue();
  }, [reloadQueue]);

  const act = async (action: ReviewAct, reason?: string): Promise<boolean> => {
    if (!detail || pending[detail.requestId]) return false;
    const { requestId, code, revision } = detail;
    const stillSelected = () => selectedId.current === requestId;
    setPending((p) => ({ ...p, [requestId]: action }));
    setConflict(null);
    try {
      const next =
        action === 'received'
          ? await customReviewModel.received(requestId, revision)
          : action === 'needs_changes'
            ? await customReviewModel.needsChanges(requestId, revision, reason ?? '')
            : await customReviewModel.approve(requestId, revision);
      // A request selected while the write was pending keeps its own record on screen.
      if (stillSelected()) {
        setLoaded((prev) => ({ key: prev.key, detail: next, error: null }));
      }
      queue.reload();
      // The code says which request the result is for, whichever one is open now.
      toast({ message: `${code} · ${DONE[action](next.approvedRevision ?? next.revision)}`, tone: 'success' });
      return true;
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 409 && action === 'approved' && stillSelected()) {
        // The dialog stays open with the conflict; its button loads the latest record.
        setConflict(CONFLICT);
      } else if (status === 409) {
        toast({ message: `${code} · ${getApiErrorMessage(err)} · โหลดข้อมูลล่าสุดแล้ว`, tone: 'danger' });
        if (stillSelected()) reloadDetail();
        else reloadQueue();
      } else {
        toast({ message: `${code} · ${getApiErrorMessage(err)}`, tone: 'danger' });
      }
      return false;
    } finally {
      setPending((p) => {
        const rest = { ...p };
        delete rest[requestId];
        return rest;
      });
    }
  };

  const pane = id ? 'review' : 'queue';

  return (
    <div className="ka-cr">
      <div className="ka-cr__ph">
        <h1>ตรวจไฟล์ Custom</h1>
        <p className="ka-cr__lead">คำขอที่รับมัดจำแล้ว · ตรวจไฟล์จากแชท LINE ก่อนอนุมัติให้ผลิต</p>
      </div>
      <div className="ka-cr-split" data-pane={pane}>
        <QueueRail queue={queue} selectedId={id} hrefFor={hrefFor} />
        {detail && !detailError ? (
          <ReviewWorkspace
            detail={detail}
            backHref={pathname}
            can={{
              received: can('job_orders', 'edit'),
              needsChanges: can('job_orders', 'reject'),
              approve: can('job_orders', 'approve'),
            }}
            canSeeSaleOrder={can('sale_orders', 'view')}
            busy={pending[detail.requestId] ?? null}
            conflict={conflict}
            onAct={act}
            onReload={reloadDetail}
            onClearConflict={() => setConflict(null)}
          />
        ) : (
          <section className="ka-cr-ws" aria-label="รายละเอียดคำขอ" aria-busy={!detailError && !!id}>
            {detailError ? (
              <div className="ka-cr-pending">
                <div className="ka-cr-ban" role="alert">
                  <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9l-6 6M9 9l6 6" /></svg>
                  <span style={{ flex: 1 }}>
                    <b>{detailError}</b>
                    <br />
                    <Button size="sm" style={{ marginTop: 8 }} onClick={reloadDetail}>ลองอีกครั้ง</Button>
                  </span>
                </div>
              </div>
            ) : id ? (
              <div className="ka-cr-pending" aria-label="กำลังโหลดคำขอ">
                <span className="ka-skel ka-skel--title" />
                <span className="ka-skel" style={{ width: '60%' }} />
                <span className="ka-skel" style={{ width: '85%' }} />
                <span className="ka-skel" style={{ width: '70%' }} />
              </div>
            ) : (
              <div className="ka-cr-empty">
                <b>เลือกคำขอจากคิว</b>
                <span className="ka-cr-cap">รายละเอียดและขั้นตรวจจะแสดงที่นี่</span>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomReviewPage />
    </Suspense>
  );
}
