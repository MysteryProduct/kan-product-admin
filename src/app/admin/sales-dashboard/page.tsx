'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardModel from '@/models/dashboard';
import type { DashboardDates } from '@/models/dashboard';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import DashboardListModal, { type OpenList } from '@/components/dashboard/DashboardListModal';
import CashflowSection from '@/components/dashboard/CashflowSection';
import SalesKpis from '@/components/dashboard/SalesKpis';
import SalesMixSection from '@/components/dashboard/SalesMixSection';
import SalesRange from '@/components/dashboard/SalesRange';
import TopProductsSection from '@/components/dashboard/TopProductsSection';
import { unavailableText } from '@/components/dashboard/blockLabels';
import {
  bangkokToday,
  datesProblem,
  periodLabel,
  presetDates,
  type PeriodPreset,
} from '@/components/dashboard/salesPeriod';
import type { SalesDashboard, SalesMix, TopProducts } from '@/types/dashboard';

const dashboardModel = new DashboardModel();

/** What one request for the period brought back, or why it did not. A part fails alone. */
interface Loaded {
  key: string;
  summary: SalesDashboard | null;
  summaryError: string | null;
  top: TopProducts | null;
  topError: string | null;
  mix: SalesMix | null;
  mixError: string | null;
}

export default function SalesDashboardPage() {
  const today = bangkokToday();
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [custom, setCustom] = useState<DashboardDates>({ from: presetDates('week', today).from, to: today });
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [openList, setOpenList] = useState<OpenList | null>(null);

  // The days asked for; null while a custom pair cannot be used, so nothing is requested for it.
  const dates = useMemo<DashboardDates | null>(() => {
    if (preset !== 'custom') return presetDates(preset, today);
    return datesProblem(custom.from, custom.to) ? null : custom;
  }, [preset, custom, today]);
  const key = dates ? `${dates.from}|${dates.to}|${retry}` : null;

  useEffect(() => {
    if (!dates || !key) return;
    let cancelled = false;
    const message = (part: string, error: unknown) => loadErrorText(part, error);
    Promise.allSettled([dashboardModel.getSalesSummary(dates), dashboardModel.getTopProducts(dates), dashboardModel.getSalesMix(dates)]).then(
      ([summary, top, mix]) => {
        if (cancelled) return;
        setLoaded({
          key,
          summary: summary.status === 'fulfilled' ? summary.value : null,
          summaryError: summary.status === 'rejected' ? message('ยอดขายและรับชำระ', summary.reason) : null,
          top: top.status === 'fulfilled' ? top.value : null,
          topError: top.status === 'rejected' ? message('สินค้าขายดี', top.reason) : null,
          mix: mix.status === 'fulfilled' ? mix.value : null,
          mixError: mix.status === 'rejected' ? message('สัดส่วนยอดขาย', mix.reason) : null,
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [dates, key]);

  // Figures belong to the period they were asked for; while a new one loads the old ones are not shown as its own.
  const current = loaded && loaded.key === key ? loaded : null;
  const isLoading = dates !== null && !current;
  const summary = current?.summary ?? null;
  const partialError = unavailableText(summary?.unavailable);

  const reload = useCallback(() => setRetry((count) => count + 1), []);

  return (
    <div className="flex-1">
      <main className="ka-page-body">
        <div className="ka-ph">
          <div>
            <h1 className="ka-ph__title">ยอดขาย</h1>
            <p className="ka-ph__lead">{dates ? `${periodLabel(dates)} · นับตามเวลาไทย` : 'เลือกช่วงวันที่ให้ถูกต้องเพื่อดูยอดขาย'}</p>
          </div>
          <SalesRange preset={preset} custom={custom} max={today} onPreset={setPreset} onCustom={setCustom} />
        </div>

        <LoadErrorBanner message={current?.summaryError ?? partialError} onRetry={reload} className="mb-4" />

        {isLoading && !summary && <p className="ka-panel__note">กำลังโหลด...</p>}
        {summary?.sales?.period && <SalesKpis period={summary.sales.period} preset={preset} onOpen={setOpenList} />}
        {summary && !summary.sales?.period && !partialError && (
          <p className="ka-panel__note">ยังไม่มีข้อมูลที่แสดงได้ตามสิทธิ์ของคุณ</p>
        )}

        <CashflowSection
          beside={<TopProductsSection data={current?.top ?? null} loading={isLoading} error={current?.topError ?? null} onRetry={reload} />}
        />
        <SalesMixSection data={current?.mix ?? null} loading={isLoading} error={current?.mixError ?? null} onRetry={reload} />
      </main>

      {openList && <DashboardListModal list={openList} onClose={() => setOpenList(null)} onChanged={reload} />}
    </div>
  );
}
