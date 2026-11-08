'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { usePermissions } from '@/hooks/usePermissions';
import { refreshStockPending } from '@/hooks/useStockPending';
import { getApiErrorMessage } from '@/lib/api-error';
import StockModel, { type CountDetail, type StockKind } from '@/models/stock';
import CountReview from '../../../components/count-review';
import CountSession from '../../../components/count-session';
import '../../../stock.css';
import { NoAccess } from '../../../components/states';

const stockModel = new StockModel();

export default function StockCountPage() {
  const { kind: kindParam, id } = useParams<{ kind: string; id: string }>();
  const kind = kindParam as StockKind;
  const knownKind = kindParam === 'material' || kindParam === 'product';
  const { can, isLoaded } = usePermissions();
  const router = useRouter();
  const toast = useToast();
  const [round, setRound] = useState<CountDetail>();
  const [error, setError] = useState('');

  const canView = can(`stock_${kind}`, 'view');
  const canAdd = can(`stock_${kind}`, 'add');
  const canEdit = can(`stock_${kind}`, 'edit');
  const allowed = knownKind && (canView || canAdd);
  const listHref = `/admin/stock?type=${kind}&tab=count`;

  const refresh = useCallback(async () => {
    setRound(await stockModel.getRound(kind, id, canView));
  }, [kind, id, canView]);

  const load = useCallback(async () => {
    setError('');
    try {
      await refresh();
    } catch (err) {
      setRound(undefined);
      setError(getApiErrorMessage(err));
    }
  }, [refresh]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isLoaded && allowed) void load();
  }, [isLoaded, allowed, load]);

  const leave = (message: string, href: string) => {
    toast({ message });
    refreshStockPending();
    router.push(href);
  };

  const back = <Link className="back" href={listHref}>กลับไปรอบนับ</Link>;

  if (isLoaded && !allowed) {
    return (
      <div className="ka-stock">
        <NoAccess />
      </div>
    );
  }
  if (error) {
    return (
      <div className="ka-stock">
        {back}
        <div className="card empty" role="alert">
          <h3>โหลดรอบนับไม่สำเร็จ</h3>
          <p className="cap">{error}</p>
          <button type="button" className="ka-btn" onClick={() => void load()}>ลองใหม่</button>
        </div>
      </div>
    );
  }
  if (!round) {
    return (
      <div className="ka-stock">
        <p className="empty cap" role="status">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="ka-stock">
      {back}
      {round.status === 'counting' ? (
        <CountSession
          kind={kind}
          round={round}
          canAdd={canAdd}
          onRefresh={refresh}
          onSubmitted={() => leave(`ส่งผลนับ ${round.code} ให้ผู้ตรวจแล้ว`, listHref)}
        />
      ) : round.summary ? (
        <CountReview
          kind={kind}
          round={round}
          canEdit={canEdit}
          onRefresh={refresh}
          onClosed={(codes) =>
            codes.length > 0
              ? leave(`สร้างคำขอปรับยอด ${codes.length} รายการจาก ${round.code} แล้ว`, `/admin/stock?type=${kind}&tab=adj`)
              : leave(`ปิดรอบ ${round.code} แล้ว`, listHref)
          }
        />
      ) : (
        // `add` alone reads no figures once counting ends (TASK-0364 Q12).
        <div className="card empty">
          <h3>รอบ {round.code} ส่งตรวจแล้ว</h3>
          <p className="cap">ผลนับดูได้เมื่อมีสิทธิ์ดูสต็อก</p>
        </div>
      )}
    </div>
  );
}
