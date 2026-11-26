'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import LoadErrorBanner from '@/components/LoadErrorBanner';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { usePermissions } from '@/hooks/usePermissions';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  POST_PRODUCTION_BADGE,
  POST_PRODUCTION_GROUPS,
  POST_PRODUCTION_PAGE_SIZE,
  POST_PRODUCTION_SEARCH_MAX,
  postProductionStep,
} from '@/lib/custom-post-production';
import { formatThaiDateTime } from '@/lib/date-format';
import CustomPostProductionModel from '@/models/custom-post-production';
import type {
  PostProductionGroup,
  PostProductionList,
  PostProductionRow,
} from '@/types/custom-post-production';
import SfIcon from '../store-fulfillment/components/sf-icon';
// The tiles, search bar and list cells are the parcel page's own classes.
import '../store-fulfillment/store-fulfillment.css';
import './custom-post-production.css';

const model = new CustomPostProductionModel();
const SEARCH_LABEL = 'ค้นหารหัสคำขอหรือรหัสใบสั่งขาย';

const formatBaht = (amount: number) =>
  new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));

/**
 * TASK-0212: every Custom request after production in one place, in three
 * groups. The page changes nothing: each row links to the page where its next
 * step is done.
 */
export default function CustomPostProductionPage() {
  const { can } = usePermissions();
  const canView = can('sale_orders', 'view');
  const canOpenFulfillment = can('store_fulfillment', 'view');
  // The balance form on the sale order page needs both (TASK-0218).
  const canRecordPayment = can('sale_orders', 'approve') && can('payment_receipts', 'add');

  const [group, setGroup] = useState<PostProductionGroup>('awaiting_balance');
  // What the box holds is not what was asked until it is submitted.
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloads, setReloads] = useState(0);
  // The answer is kept with the group it answers, so the rows of one group are
  // never shown under another tile.
  const [loaded, setLoaded] = useState<{ group: PostProductionGroup; body: PostProductionList } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) return;
    // Only the newest request may change the page.
    let active = true;
    model
      .list(group, search, page, POST_PRODUCTION_PAGE_SIZE)
      .then((body) => {
        if (!active) return;
        setLoaded({ group, body });
        setError('');
      })
      .catch((err: unknown) => {
        if (active) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, group, search, page, reloads]);

  if (!canView) {
    return (
      <div className="ka-sf">
        <div className="ka-sf-card ka-sf-empty">
          <span className="ka-sf-empty__icon">
            <SfIcon name="lock" />
          </span>
          <h3>คุณไม่มีสิทธิ์เข้าถึงงาน Custom หลังผลิต</h3>
          <p className="ka-sf-sub">กรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
      </div>
    );
  }

  // Loading starts with the change itself, not inside the effect; `reloads`
  // makes a repeated search ask again.
  const ask = (next: { group?: PostProductionGroup; search?: string; page?: number }) => {
    setLoading(true);
    setError('');
    if (next.group !== undefined) setGroup(next.group);
    if (next.search !== undefined) setSearch(next.search);
    setPage(next.page ?? 1);
    setReloads((count) => count + 1);
  };
  const clearSearch = () => {
    setSearchDraft('');
    ask({ search: '' });
  };

  const current = loaded && loaded.group === group ? loaded.body : null;
  const counts = loaded?.body.meta.counts;
  const searching = searchDraft.trim() !== '' || search !== '';

  const code = (row: PostProductionRow) => (
    <>
      <span className="ka-cp-code">{row.code}</span>
      <span className="ka-sf-cap ka-sf-num block whitespace-nowrap">ใบสั่งขาย {row.saleOrderCode}</span>
      <span className="ka-sf-cap ka-sf-num block whitespace-nowrap">อัปเดต {formatThaiDateTime(row.updatedAt)}</span>
    </>
  );
  const buyer = (row: PostProductionRow) => (
    <>
      <span className="block break-words">{row.buyerName}</span>
      <span className="ka-sf-cap ka-sf-num block">{Number(row.pieces).toLocaleString('th-TH')} ชิ้น</span>
    </>
  );
  const balanceClass = (row: PostProductionRow) =>
    Number(row.outstanding) > 0 ? 'font-semibold' : 'ka-cp-zero';
  const stepLink = (row: PostProductionRow, className = '') => {
    const { link } = postProductionStep(row, canOpenFulfillment, canRecordPayment);
    // Only the parcel page link can be missing; every layout shows the dash in its place (D8).
    if (!link)
      return (
        // `relative` keeps the hidden text inside the cell (frontend.md, admin layout trap).
        <span className={`ka-cp-none ${className}`}>
          <span aria-hidden="true">–</span>
          <span className="sr-only">ไม่มีลิงก์ คุณไม่มีสิทธิ์ดูหน้าจัดส่ง</span>
        </span>
      );
    return (
      <Link href={link.href} aria-label={link.name} className={`ka-sf-open ka-cp-go ${className}`}>
        {link.label}
        <SfIcon name="right" small />
      </Link>
    );
  };
  // The badge, and under it what the request waits for inside its group.
  const state = (row: PostProductionRow) => {
    const step = postProductionStep(row, canOpenFulfillment, canRecordPayment);
    const badge = POST_PRODUCTION_BADGE[row.group];
    return (
      <>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        {step.note &&
          (step.warning ? (
            <span className="ka-cp-warn">
              <SfIcon name="warn" small />
              <span>{step.note}</span>
            </span>
          ) : (
            <span className="ka-sf-cap ka-cp-note block">{step.note}</span>
          ))}
      </>
    );
  };

  const columns: DataTableColumn<PostProductionRow>[] = [
    { key: 'code', label: 'คำขอ', render: (_, row) => code(row) },
    { key: 'buyerName', label: 'ลูกค้า', render: (_, row) => buyer(row) },
    {
      key: 'total',
      label: 'ยอดรวม (บาท)',
      render: (_, row) => (
        <span className="numeric block whitespace-nowrap text-right">
          {formatBaht(row.total)}
          <span className="ka-sf-cap block">ชำระแล้ว {formatBaht(row.paid)}</span>
        </span>
      ),
    },
    {
      key: 'outstanding',
      label: 'ยอดคงเหลือ (บาท)',
      render: (_, row) => (
        <span className="numeric block whitespace-nowrap text-right">
          <span className={balanceClass(row)}>{formatBaht(row.outstanding)}</span>
          {/* Below 1280px the total column is gone; its two figures move here. */}
          <span className="ka-sf-cap ka-cp-narrow">ยอดรวม {formatBaht(row.total)}</span>
          <span className="ka-sf-cap ka-cp-narrow">ชำระแล้ว {formatBaht(row.paid)}</span>
        </span>
      ),
    },
    {
      key: 'group',
      label: 'สถานะ',
      render: (_, row) => (
        <>
          {state(row)}
          {stepLink(row, 'ka-cp-narrow')}
        </>
      ),
    },
    {
      key: 'saleOrderId',
      label: 'ขั้นตอนถัดไป',
      render: (_, row) => stepLink(row),
    },
  ];

  const card = (row: PostProductionRow) => {
    const link = stepLink(row);
    const step = postProductionStep(row, canOpenFulfillment, canRecordPayment);
    const badge = POST_PRODUCTION_BADGE[row.group];
    return (
      <div className="ka-sf-rowcard ka-cp-card">
        <div className="ka-sf-row ka-sf-row--wrap ka-sf-row--between">
          <span className="ka-cp-code">{row.code}</span>
          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
        </div>
        <div>
          <span className="ka-sf-cap ka-sf-num block">ใบสั่งขาย {row.saleOrderCode}</span>
          <span className="ka-sf-cap ka-sf-num block">อัปเดต {formatThaiDateTime(row.updatedAt)}</span>
        </div>
        <div>{buyer(row)}</div>
        <dl className="ka-cp-money">
          <div>
            <dt>ยอดรวม</dt>
            <dd>฿{formatBaht(row.total)}</dd>
          </div>
          <div>
            <dt>ชำระแล้ว</dt>
            <dd>฿{formatBaht(row.paid)}</dd>
          </div>
          <div>
            <dt>ยอดคงเหลือ</dt>
            <dd className={balanceClass(row)}>฿{formatBaht(row.outstanding)}</dd>
          </div>
        </dl>
        {step.note &&
          (step.warning ? (
            <p className="ka-cp-warn">
              <SfIcon name="warn" small />
              <span>{step.note}</span>
            </p>
          ) : (
            <p className="ka-sf-cap">{step.note}</p>
          ))}
        <div className="ka-cp-foot">{link}</div>
      </div>
    );
  };

  return (
    <div className="ka-sf ka-cp">
      <div>
        <h1>งาน Custom หลังผลิต</h1>
        <p className="ka-sf-sub">
          คำขอ Custom ที่ผลิตเสร็จแล้ว ตั้งแต่รอรับยอดคงเหลือจนถึงจัดส่ง เปิดขั้นตอนถัดไปได้จากแต่ละรายการ
        </p>
      </div>

      <section className="ka-sf-tiles ka-cp-tiles" aria-label="กลุ่มงาน">
        {POST_PRODUCTION_GROUPS.map((tile) => (
          <button
            key={tile.group}
            type="button"
            className="ka-sf-tile"
            aria-pressed={group === tile.group}
            onClick={() => {
              if (group !== tile.group) ask({ group: tile.group });
            }}
          >
            <span className="ka-sf-row ka-sf-row--between">
              <span className={`ka-sf-tile__icon ka-sf-tone--${tile.tone}`}>
                <SfIcon name={tile.icon} />
              </span>
              {counts ? (
                <span className="ka-sf-tile__num">{Number(counts[tile.group]).toLocaleString('th-TH')}</span>
              ) : (
                loading && <span className="ka-skel ka-cp-tilenum" aria-hidden="true" />
              )}
            </span>
            <span className="ka-sf-tile__label">{tile.label}</span>
          </button>
        ))}
      </section>

      <section className="ka-sf-card ka-sf-card--clip" aria-label="รายการงาน Custom หลังผลิต">
        <form
          role="search"
          className="ka-sf-fbar"
          onSubmit={(event) => {
            event.preventDefault();
            ask({ search: searchDraft.trim() });
          }}
        >
          <label className="ka-sf-search">
            <SfIcon name="search" small />
            <input
              type="search"
              aria-label={SEARCH_LABEL}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              maxLength={POST_PRODUCTION_SEARCH_MAX}
              placeholder={SEARCH_LABEL}
              className="ka-input"
            />
          </label>
          <span className="ka-sf-found" aria-live="polite">
            {loading ? 'กำลังโหลด...' : current && !error ? `พบ ${current.meta.total} รายการ` : ''}
          </span>
          {searching && (
            <button type="button" onClick={clearSearch} className="ka-btn ka-btn--ghost">
              ล้างตัวกรอง
            </button>
          )}
        </form>

        {/* A page that failed to load shows only its error, never the rows of
            the page before it; the pagination stays so staff can move on. */}
        <LoadErrorBanner
          message={error ? `โหลดรายการงาน Custom หลังผลิตไม่สำเร็จ: ${error}` : null}
          onRetry={() => ask({ page })}
          className="m-4"
        />
        {error ? (
          <div className="ka-sf-pager">
            <Pagination meta={current?.meta ?? null} currentPage={page} onPageChange={(next) => ask({ page: next })} />
          </div>
        ) : (
          <div className="ka-sf-flat ka-cp-list">
            <DataTable
              data={current?.data ?? []}
              columns={columns}
              keyField="id"
              pageSize={POST_PRODUCTION_PAGE_SIZE}
              loading={loading && !current}
              disabled={loading}
              paginationMeta={current?.meta ?? null}
              currentPage={page}
              onPageChange={(next) => ask({ page: next })}
              cardTitleKey="code"
              emptyHint="ไม่มีงานในกลุ่มนี้"
              activeFilters={search ? ['คำค้นหา'] : []}
              onClearFilters={clearSearch}
              renderCard={card}
            />
          </div>
        )}
      </section>
    </div>
  );
}
