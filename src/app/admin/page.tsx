'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardModel from '@/models/dashboard';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import GreetingPanel from '@/components/dashboard/GreetingPanel';
import PendingWork, { summarizePending } from '@/components/dashboard/PendingWork';
import RevenueCard from '@/components/dashboard/RevenueCard';
import { useAuth } from '@/contexts/AuthContext';
import DashboardListModal, { type OpenList } from '@/components/dashboard/DashboardListModal';
import StockOut from '@/components/dashboard/StockOut';
import StockOverview from '@/components/dashboard/StockOverview';
import { usePermissions } from '@/hooks/usePermissions';
import Operations from '@/components/dashboard/Operations';
import { unavailableText } from '@/components/dashboard/blockLabels';
import type { DashboardSummary, SalesDashboard } from '@/types/dashboard';

const dashboardModel = new DashboardModel();

export default function Home() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openList, setOpenList] = useState<OpenList | null>(null);
  const { can } = usePermissions();
  const { user } = useAuth();
  const [sales, setSales] = useState<SalesDashboard['sales']>();
  // The stock overview reads its own endpoint; a record changed from a detail view makes it read again.
  const [stockReload, setStockReload] = useState(0);
  const [stockState, setStockState] = useState<'loading' | 'shown' | 'failed'>('loading');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setSummary(await dashboardModel.getSummary());
      setError(null);
    } catch (loadError) {
      setError(loadErrorText('ภาพรวม', loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Money received comes from the sales dashboard's figures. If they cannot be read the card is left
  // out: the page does not show an error for a block the employee may not have.
  useEffect(() => {
    let cancelled = false;
    dashboardModel
      .getSalesSummary()
      .then((response) => {
        if (!cancelled) setSales(response.sales);
      })
      .catch(() => {
        if (!cancelled) setSales(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = summarizePending(summary?.pending_work);

  const partialError = unavailableText(summary?.unavailable);
  const hasContent = Boolean(
    summary?.pending_work || summary?.stock_out || summary?.operations || partialError,
  );

  return (
    <div className="flex-1">
      <main className="ka-page-body">
        <GreetingPanel
          name={user?.employee_username || 'ผู้ใช้'}
          waiting={pending?.waiting}
          urgent={pending?.urgent}
          links={[
            ...(can('job_orders', 'add') ? [{ href: '/admin/job-orders', label: 'ไปหน้างานผลิต' }] : []),
            ...(can('sale_orders', 'add') ? [{ href: '/admin/sale-orders', label: 'ไปหน้าใบสั่งขาย', primary: true }] : []),
          ]}
        />

        <LoadErrorBanner message={error ?? partialError} onRetry={() => void load()} className="mb-4" />

        <div className="ka-dash">
          {summary?.pending_work && <PendingWork work={summary.pending_work} onOpen={setOpenList} />}
          <div className="ka-dash__side">
            {sales && <RevenueCard sales={sales} />}
            {summary?.operations && <Operations operations={summary.operations} onOpen={setOpenList} />}
          </div>
        </div>

        {can('products', 'view') && (
          <StockOverview reloadToken={stockReload} onOpen={setOpenList} onState={setStockState} />
        )}
        {summary?.stock_out && (
          <StockOut
            stock={summary.stock_out}
            onOpen={setOpenList}
            hideProducts={can('products', 'view') && stockState !== 'failed'}
            canOrder={can('purchase_orders', 'add')}
          />
        )}

        {isLoading && !summary && <p className="text-[14px] text-[var(--ink-muted)]">กำลังโหลด...</p>}
        {summary && !hasContent && (
          <p className="text-[14px] text-[var(--ink-muted)]">ยังไม่มีข้อมูลที่แสดงได้ตามสิทธิ์ของคุณ</p>
        )}
      </main>

      {openList && (
        <DashboardListModal
          list={openList}
          onClose={() => setOpenList(null)}
          onChanged={() => {
            void load();
            setStockReload((token) => token + 1);
          }}
        />
      )}
    </div>
  );
}
