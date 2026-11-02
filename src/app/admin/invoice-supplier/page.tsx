'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import DocumentCode from '@/components/DocumentCode';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import { usePermissions } from '@/hooks/usePermissions';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate, todayLocalIso } from '@/lib/date-format';
import { usePageCrumb } from '@/lib/page-crumb';
import { VAT_TYPE_LABELS } from '@/lib/vat';
import InvoiceSupplierModel, { buildCreateDto, buildUpdateDto } from '@/models/invoice-supplier';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import SupplierModel from '@/models/supplier';
import type { PaginationMeta } from '@/types/pagination';
import type { InvoiceSupplierFormPayload, InvoiceSupplierPayment, InvoiceSupplierRow } from '@/types/invoice-supplier';
import type { PurchaseReceipt } from '@/types/purchase-receipt';
import InvoiceDetail from './components/invoice-detail';
import InvoiceForm from './components/invoice-form';
import {
  DISPLAY_STATUS_KEYS,
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONES,
  DisplayStatus,
  dueNote,
  formatBaht,
  formatMoney,
  invoiceView,
  InvoiceView,
  monthLabel,
  paidPercent,
} from './lib/is-display';

const invoiceSupplierModel = new InvoiceSupplierModel();
const purchaseReceiptModel = new PurchaseReceiptModel();
const supplierModel = new SupplierModel();

const PAGE_SIZE = 10;
// The API has no status or due-date filter and no totals, so the latest invoices are loaded once and the
// summary, status chips, search, sort and pages are worked out here (TASK-0327 D5, D11).
const LOCAL_LIMIT = 500;

type SortKey = 'invoice_supplier_date' | 'invoice_supplier_due_date' | 'invoice_supplier_total';
type Sort = { key: SortKey; order: 'ASC' | 'DESC' };
type StatusFilter = 'all' | DisplayStatus;

type ModalState =
  | { kind: 'create'; receipt: PurchaseReceipt; accounts: InvoiceSupplierPayment[] }
  | { kind: 'view'; id: string; accounts: InvoiceSupplierPayment[] }
  | { kind: 'edit'; id: string; accounts: InvoiceSupplierPayment[] }
  | null;

async function supplierAccounts(supplierId: string | undefined): Promise<InvoiceSupplierPayment[]> {
  if (!supplierId) return [];
  const supplier = await supplierModel.getSupplierWithPaymentsById(supplierId);
  return (supplier.payments || []).map((payment) => ({
    payment_id: payment.payment_id,
    account_name: payment.account_name,
    account_number: payment.account_number,
    account_branch: payment.account_branch,
    bank_name: payment.bank_name,
  }));
}

function matches(view: InvoiceView, term: string): boolean {
  const text = term.toLowerCase();
  return [view.row.invoice_supplier_code, view.row.legacy_code, view.row.invoice_supplier_name, view.supplierName, view.receiptCode].some(
    (value) => value?.toLowerCase().includes(text),
  );
}

const Icon = ({ d, className = 'h-5 w-5' }: { d: string; className?: string }) => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICONS = {
  money: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  alert: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  check: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  search: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  eye: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  edit: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10',
  chevron: 'm8.25 4.5 7.5 7.5-7.5 7.5',
};

/** Approved receipts that have no supplier invoice yet. */
function ReceiptQueue({ canAdd, refreshKey, onIssue, opening }: {
  canAdd: boolean;
  refreshKey: number;
  onIssue: (receipt: PurchaseReceipt) => void;
  opening: string | null;
}) {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PurchaseReceipt[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${page}|${search}|${refreshKey}|${attempt}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed === search) return;
    const timer = window.setTimeout(() => {
      setSearch(trimmed);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText, search]);

  useEffect(() => {
    let active = true;
    purchaseReceiptModel
      .getApprovedPurchaseReceiptsForInvoiceStatus(page, PAGE_SIZE, search || undefined, 'entry_date', 'DESC')
      .then((response) => {
        if (!active) return;
        setRows(response.data ?? []);
        setMeta(response.meta ?? null);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (active) setError(loadErrorText('ใบรับสินค้าที่รอออกใบชำระหนี้', failure));
      })
      .finally(() => {
        if (active) setLoadedKey(`${page}|${search}|${refreshKey}|${attempt}`);
      });
    return () => {
      active = false;
    };
  }, [page, search, refreshKey, attempt]);

  const total = meta?.total ?? rows.length;
  const issueButton = (receipt: PurchaseReceipt) =>
    canAdd && (
      <button
        type="button"
        className="ka-btn ka-is-receipt-btn"
        onClick={() => onIssue(receipt)}
        disabled={opening !== null}
        aria-busy={opening === receipt.purchase_receipt_id || undefined}
      >
        <Icon d={ICONS.plus} className="h-4 w-4" />
        ออกใบชำระหนี้
        <span className="sr-only"> {receipt.purchase_receipt_code}</span>
      </button>
    );

  return (
    <section className="ka-card ka-po-clip" aria-labelledby="is-queue-title" aria-busy={loading || undefined}>
      <div className="ka-po-chd">
        <div className="ka-is-chd-title">
          <h2 id="is-queue-title" className="ka-po-h2">ใบรับสินค้ารอออกใบชำระหนี้</h2>
          {!error && meta && <span className="ka-is-count numeric">{total.toLocaleString('th-TH')}</span>}
          <span className="ka-po-cap">อนุมัติแล้ว ยังไม่ได้ตั้งหนี้</span>
        </div>
        <div className="ka-po-search">
          <Icon d={ICONS.search} />
          <input
            type="search"
            className="ka-input"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="เลขที่ใบรับสินค้า"
            aria-label="ค้นหาใบรับสินค้าที่รอออกใบชำระหนี้"
          />
        </div>
      </div>

      {error ? (
        <div className="ka-po-cp">
          <LoadErrorBanner message={error} onRetry={() => setAttempt((value) => value + 1)} />
        </div>
      ) : !loading && rows.length === 0 ? (
        <div className="ka-po-empty">
          <p className="ka-po-empty__t">{search ? `ไม่พบใบรับสินค้าที่ตรงกับ “${search}”` : 'ไม่มีใบรับสินค้าที่รอออกใบชำระหนี้'}</p>
          <p className="ka-po-cap">{search ? 'ลองค้นด้วยเลขที่อื่น' : 'ใบรับสินค้าที่อนุมัติแล้วจะมาอยู่ที่นี่จนกว่าจะออกใบชำระหนี้'}</p>
        </div>
      ) : (
        <>
          <div className="ka-po-tw ka-po-tw--list">
            <table className={`ka-po-lt ka-is-lt${loading ? ' ka-po-lt--loading' : ''}`}>
              <caption className="sr-only">ใบรับสินค้าที่รอออกใบชำระหนี้</caption>
              <thead>
                <tr>
                  <th scope="col">เลขที่ใบรับสินค้า</th>
                  <th scope="col">ผู้จัดจำหน่าย</th>
                  <th scope="col" className="ka-is-lg">วันที่รับสินค้า</th>
                  <th scope="col" className="ka-is-lg">VAT</th>
                  <th scope="col" className="ka-po-r">ยอดรวม (บาท)</th>
                  {canAdd && <th scope="col" className="ka-is-actcol"><span className="sr-only">ออกใบชำระหนี้</span></th>}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0
                  ? Array.from({ length: 2 }, (_, index) => (
                      <tr key={index} aria-hidden="true">
                        <td colSpan={canAdd ? 6 : 5}><span className="ka-skel" /></td>
                      </tr>
                    ))
                  : rows.map((receipt) => (
                      <tr key={receipt.purchase_receipt_id}>
                        <td>
                          <span className="ka-po-code"><DocumentCode code={receipt.purchase_receipt_code || '-'} legacyCode={receipt.legacy_code} search={search} /></span>
                          <span className="ka-is-sub ka-is-md numeric">รับ {formatThaiDate(receipt.entry_date)} · {VAT_TYPE_LABELS[receipt.vat_type || 'none']}</span>
                        </td>
                        <td><span className="ka-po-sup__n">{receipt.supplier?.supplier_name || '-'}</span></td>
                        <td className="ka-is-lg numeric ka-po-nowrap">{formatThaiDate(receipt.entry_date)}</td>
                        <td className="ka-is-lg"><StatusBadge tone="neutral">{VAT_TYPE_LABELS[receipt.vat_type || 'none']}</StatusBadge></td>
                        <td className="ka-po-r"><span className="numeric ka-po-amt">{formatMoney(Number(receipt.purchase_receipt_total || 0))}</span></td>
                        {canAdd && <td className="ka-po-r">{issueButton(receipt)}</td>}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <ul className="ka-po-mlist" aria-label="ใบรับสินค้าที่รอออกใบชำระหนี้">
            {rows.map((receipt) => (
              <li key={receipt.purchase_receipt_id} className="ka-is-receipt-mc">
                <span className="ka-po-mc__row">
                  <span className="min-w-0">
                    <span className="ka-po-code block"><DocumentCode code={receipt.purchase_receipt_code || '-'} legacyCode={receipt.legacy_code} search={search} /></span>
                    <span className="ka-po-cap ka-po-mc__meta">{receipt.supplier?.supplier_name || '-'}</span>
                  </span>
                  <StatusBadge tone="neutral">{VAT_TYPE_LABELS[receipt.vat_type || 'none']}</StatusBadge>
                </span>
                <span className="ka-po-mc__row">
                  <span className="ka-po-cap ka-po-mc__meta numeric">รับสินค้า {formatThaiDate(receipt.entry_date)}</span>
                  <span className="numeric ka-po-mc__amt">{formatBaht(Number(receipt.purchase_receipt_total || 0))}</span>
                </span>
                {issueButton(receipt)}
              </li>
            ))}
          </ul>
          {meta && meta.last_page > 1 && (
            <div className="ka-po-pager">
              <span className="ka-po-cap numeric">ทั้งหมด {total.toLocaleString('th-TH')} ใบ</span>
              <Pagination meta={meta} currentPage={page} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function InvoiceSupplierPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const canAdd = can('invoice_supplier', 'add');
  const canEdit = can('invoice_supplier', 'edit');
  const canDelete = can('invoice_supplier', 'delete');

  usePageCrumb({ parents: ['จัดซื้อ'], current: 'ใบชำระหนี้ผู้จัดจำหน่าย' });

  // The latest invoices, for the summary cards, the status chips and a status filter (TASK-0327 D5).
  const [rows, setRows] = useState<InvoiceSupplierRow[]>([]);
  const [capped, setCapped] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const summaryLoading = loadedKey !== refreshKey;

  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>({ key: 'invoice_supplier_date', order: 'DESC' });
  const [page, setPage] = useState(1);

  // Without a status filter the table is the API's own page, so every invoice stays reachable (D5).
  const apiMode = statusFilter === 'all';
  const [apiRows, setApiRows] = useState<InvoiceSupplierRow[]>([]);
  const [apiMeta, setApiMeta] = useState<PaginationMeta | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiAttempt, setApiAttempt] = useState(0);
  const apiKey = `${page}|${query}|${sort.key}|${sort.order}|${refreshKey}|${apiAttempt}`;
  const [apiLoadedKey, setApiLoadedKey] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<InvoiceView | null>(null);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    invoiceSupplierModel
      .getInvoiceSuppliers(1, LOCAL_LIMIT, undefined, 'invoice_supplier_date', 'DESC')
      .then((response) => {
        if (!active) return;
        setRows(response.data ?? []);
        setCapped((response.meta?.total ?? 0) > LOCAL_LIMIT);
        setSummaryError(null);
      })
      .catch((error: unknown) => {
        if (active) setSummaryError(loadErrorText('สรุปใบชำระหนี้', error));
      })
      .finally(() => {
        if (active) setLoadedKey(refreshKey);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!apiMode) return;
    let active = true;
    const key = `${page}|${query}|${sort.key}|${sort.order}|${refreshKey}|${apiAttempt}`;
    invoiceSupplierModel
      .getInvoiceSuppliers(page, PAGE_SIZE, query || undefined, sort.key, sort.order)
      .then((response) => {
        if (!active) return;
        setApiRows(response.data ?? []);
        setApiMeta(response.meta ?? null);
        setApiError(null);
        // A page beyond the end (after a delete) falls back to the last one.
        if (response.meta && response.meta.last_page > 0 && page > response.meta.last_page) setPage(response.meta.last_page);
      })
      .catch((error: unknown) => {
        if (active) setApiError(loadErrorText('รายการใบชำระหนี้', error));
      })
      .finally(() => {
        if (active) setApiLoadedKey(key);
      });
    return () => {
      active = false;
    };
  }, [apiMode, page, query, sort.key, sort.order, refreshKey, apiAttempt]);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed === query) return;
    const timer = window.setTimeout(() => {
      setQuery(trimmed);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText, query]);

  const today = todayLocalIso();
  const views = useMemo(() => rows.map((row) => invoiceView(row, today)), [rows, today]);
  const apiViews = useMemo(() => apiRows.map((row) => invoiceView(row, today)), [apiRows, today]);

  const summary = useMemo(() => {
    const open = views.filter((view) => view.status !== 'paid' && view.status !== 'cancelled');
    const soon = open.filter((view) => view.status !== 'overdue' && view.days !== null && view.days >= 0 && view.days <= 7);
    const overdue = open.filter((view) => view.status === 'overdue');
    const month = today.slice(0, 7);
    const paidThisMonth = views.filter((view) => view.status === 'paid' && view.row.invoice_supplier_date?.slice(0, 7) === month);
    const sum = (list: InvoiceView[], pick: (view: InvoiceView) => number) => list.reduce((total, view) => total + pick(view), 0);
    const lastDue = soon.reduce<string | null>((latest, view) => {
      const due = view.row.invoice_supplier_due_date;
      return !latest || due > latest ? due : latest;
    }, null);
    return {
      open: { count: open.length, amount: sum(open, (view) => view.remaining) },
      soon: { count: soon.length, amount: sum(soon, (view) => view.remaining), lastDue },
      overdue: { count: overdue.length, amount: sum(overdue, (view) => view.remaining) },
      paid: { count: paidThisMonth.length, amount: sum(paidThisMonth, (view) => view.total) },
    };
  }, [views, today]);

  // Status chips and a status filter work on the loaded invoices; the API has no status filter.
  const searched = useMemo(() => (query ? views.filter((view) => matches(view, query)) : views), [views, query]);
  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { all: searched.length, pending: 0, partial: 0, overdue: 0, paid: 0, cancelled: 0 };
    searched.forEach((view) => {
      result[view.status] += 1;
    });
    return result;
  }, [searched]);

  const localFiltered = useMemo(() => {
    if (apiMode) return [];
    const sign = sort.order === 'ASC' ? 1 : -1;
    const value = (view: InvoiceView) =>
      sort.key === 'invoice_supplier_total' ? view.total : new Date(view.row[sort.key]).getTime() || 0;
    return searched.filter((view) => view.status === statusFilter).sort((a, b) => sign * (value(a) - value(b)));
  }, [apiMode, searched, statusFilter, sort]);

  const loading = apiMode ? apiLoadedKey !== apiKey : summaryLoading;
  const listError = apiMode ? apiError : summaryError;
  const total = apiMode ? apiMeta?.total ?? apiRows.length : localFiltered.length;
  const lastPage = apiMode ? Math.max(1, apiMeta?.last_page ?? 1) : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shownPage = Math.min(page, lastPage);
  const pageRows = apiMode ? apiViews : localFiltered.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE);
  const pagerMeta: PaginationMeta = { total, page: shownPage, last_page: lastPage, limit: PAGE_SIZE };
  const from = total === 0 ? 0 : (shownPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(shownPage * PAGE_SIZE, total);
  const filteredBy = Boolean(query) || statusFilter !== 'all';
  const nothingYet = !loading && !listError && total === 0 && !filteredBy;
  const noMatch = !loading && !listError && total === 0 && filteredBy;
  const retryList = () => (apiMode ? setApiAttempt((value) => value + 1) : refresh());

  const chips: StatusFilter[] = ['all', ...DISPLAY_STATUS_KEYS.filter((key) => key !== 'cancelled' || counts.cancelled > 0)];
  const chipLabel = (key: StatusFilter) => (key === 'all' ? 'ทั้งหมด' : DISPLAY_STATUS_LABELS[key]);
  // "ทั้งหมด" is the API's own count when it lists the table; the others count the loaded invoices.
  const chipCount = (key: StatusFilter) => (key === 'all' && apiMode && apiMeta ? apiMeta.total : counts[key]);
  const chipsLoading = summaryLoading || (apiMode && loading);

  const toggleSort = (key: SortKey) => {
    setSort((current) => (current.key === key ? { key, order: current.order === 'ASC' ? 'DESC' : 'ASC' } : { key, order: 'DESC' }));
    setPage(1);
  };
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.order === 'ASC' ? 'ascending' : 'descending') : undefined);
  const sortButton = (key: SortKey, label: string) => (
    <button type="button" className="inline-flex items-center gap-1 font-[inherit] text-inherit" onClick={() => toggleSort(key)}>
      {label}
      <span aria-hidden="true">{sort.key === key ? (sort.order === 'ASC' ? '↑' : '↓') : '↕'}</span>
    </button>
  );

  const currentView =
    modal && modal.kind !== 'create'
      ? apiViews.find((view) => view.row.invoice_supplier_id === modal.id) ??
        views.find((view) => view.row.invoice_supplier_id === modal.id) ??
        null
      : null;

  const openWithAccounts = async (key: string, supplierId: string | undefined, next: (accounts: InvoiceSupplierPayment[]) => ModalState) => {
    setOpening(key);
    try {
      setModal(next(await supplierAccounts(supplierId)));
    } catch (error) {
      // Without the supplier's accounts a bank round cannot be chosen; the form still opens with cash.
      toast({ message: `โหลดบัญชีของผู้จัดจำหน่ายไม่สำเร็จ ${getApiErrorMessage(error)} เลือกได้เฉพาะเงินสด`, tone: 'danger' });
      setModal(next([]));
    } finally {
      setOpening(null);
    }
  };

  const openInvoice = (view: InvoiceView, kind: 'view' | 'edit') =>
    void openWithAccounts(view.row.invoice_supplier_id, view.row.supplier?.supplier_id || view.row.supplier_id, (accounts) => ({
      kind,
      id: view.row.invoice_supplier_id,
      accounts,
    }));

  const issue = (receipt: PurchaseReceipt) =>
    void openWithAccounts(receipt.purchase_receipt_id, receipt.supplier_id, (accounts) => ({ kind: 'create', receipt, accounts }));

  const handleCreate = async (receipt: PurchaseReceipt, payload: InvoiceSupplierFormPayload) => {
    const created = await invoiceSupplierModel.createInvoiceSupplier(buildCreateDto(receipt.purchase_receipt_id, payload));
    // The API answers with `{ data: invoice }` (findOne), which the model passes on as it is.
    const wrapped = created as InvoiceSupplierRow & { data?: InvoiceSupplierRow };
    const code = wrapped?.data?.invoice_supplier_code ?? wrapped?.invoice_supplier_code;
    setModal(null);
    toast({ message: code ? `ออกใบชำระหนี้ ${code} แล้ว` : 'ออกใบชำระหนี้แล้ว', tone: 'success' });
    refresh();
  };

  const handleUpdate = async (view: InvoiceView, payload: InvoiceSupplierFormPayload) => {
    await invoiceSupplierModel.updateInvoiceSupplier(view.row.invoice_supplier_id, buildUpdateDto(payload));
    setModal(null);
    toast({ message: `บันทึกการแก้ไข ${view.row.invoice_supplier_code} แล้ว`, tone: 'success' });
    refresh();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try {
      await invoiceSupplierModel.deleteInvoiceSupplier(target.row.invoice_supplier_id);
      setModal(null);
      toast({ message: `ลบใบชำระหนี้ ${target.row.invoice_supplier_code} แล้ว`, tone: 'success' });
      refresh();
    } catch (error) {
      toast({ message: `ลบ ${target.row.invoice_supplier_code} ไม่สำเร็จ ${getApiErrorMessage(error)}`, tone: 'danger' });
    }
  };

  const statsReady = !summaryLoading && !summaryError;
  // A failed load shows a dash and the banner above the cards, never an endless skeleton.
  const stat = (value: string) =>
    statsReady ? (
      <span className="ka-is-kpi__v numeric">{value}</span>
    ) : summaryError ? (
      <span className="ka-is-kpi__v">–</span>
    ) : (
      <span className="ka-skel" aria-hidden="true" />
    );
  const count = (value: number) => `${value.toLocaleString('th-TH')} ใบ`;

  return (
    <div className="ka-page-body ka-po">
      <div className="ka-po-ph">
        <div className="ka-po-ph__main">
          <h1 className="ka-ph__title">ใบชำระหนี้ผู้จัดจำหน่าย</h1>
          <p className="ka-po-cap">ตั้งหนี้จากใบรับสินค้าที่อนุมัติแล้ว และบันทึกการจ่ายเงินได้หลายงวด</p>
        </div>
      </div>

      {summaryError && <LoadErrorBanner message={summaryError} onRetry={refresh} />}

      <section className="ka-is-kpis" aria-label="สรุปยอด" aria-busy={summaryLoading || undefined}>
        <div className="ka-is-kpi">
          <span className="ka-is-kpi__icon" data-tone="brand"><Icon d={ICONS.money} /></span>
          <div className="ka-is-kpi__body">
            <span className="ka-is-kpi__k">ยอดค้างชำระ</span>
            {stat(formatBaht(summary.open.amount))}
            <span className="ka-is-kpi__n">{statsReady ? count(summary.open.count) : ' '}</span>
          </div>
        </div>
        <div className="ka-is-kpi">
          <span className="ka-is-kpi__icon" data-tone="warning"><Icon d={ICONS.clock} /></span>
          <div className="ka-is-kpi__body">
            <span className="ka-is-kpi__k">ครบกำหนดใน 7 วัน</span>
            {stat(formatBaht(summary.soon.amount))}
            <span className="ka-is-kpi__n" data-tone={summary.soon.count > 0 ? 'warning' : undefined}>
              {statsReady ? (summary.soon.lastDue ? `${count(summary.soon.count)} · ภายใน ${formatThaiDate(summary.soon.lastDue)}` : 'ไม่มี') : ' '}
            </span>
          </div>
        </div>
        <div className="ka-is-kpi">
          <span className="ka-is-kpi__icon" data-tone="danger"><Icon d={ICONS.alert} /></span>
          <div className="ka-is-kpi__body">
            <span className="ka-is-kpi__k">เกินกำหนด</span>
            {stat(formatBaht(summary.overdue.amount))}
            <span className="ka-is-kpi__n" data-tone={summary.overdue.count > 0 ? 'danger' : undefined}>
              {statsReady ? (summary.overdue.count > 0 ? `${count(summary.overdue.count)} · ต้องติดตาม` : 'ไม่มี') : ' '}
            </span>
          </div>
        </div>
        <div className="ka-is-kpi">
          <span className="ka-is-kpi__icon" data-tone="success"><Icon d={ICONS.check} /></span>
          <div className="ka-is-kpi__body">
            <span className="ka-is-kpi__k">จ่ายแล้วเดือนนี้</span>
            {stat(formatBaht(summary.paid.amount))}
            <span className="ka-is-kpi__n">{statsReady ? `${count(summary.paid.count)} ที่ชำระครบ · ลงวันที่ ${monthLabel(today)}` : ' '}</span>
          </div>
        </div>
      </section>

      <section className="ka-is-hero" aria-label="สรุปยอด" aria-busy={summaryLoading || undefined}>
        <div className="ka-is-hero__main">
          <span className="ka-is-hero__k">ยอดค้างชำระทั้งหมด</span>
          <span className="ka-is-hero__v numeric">{statsReady ? formatBaht(summary.open.amount) : '–'}</span>
          {statsReady && (summary.soon.count > 0 || summary.overdue.count > 0) && (
            <div className="ka-is-hero__tags">
              {summary.soon.count > 0 && <span data-tone="warning" className="numeric">ครบใน 7 วัน {formatBaht(summary.soon.amount)}</span>}
              {summary.overdue.count > 0 && <span data-tone="danger" className="numeric">เกินกำหนด {formatBaht(summary.overdue.amount)}</span>}
            </div>
          )}
        </div>
        <div className="ka-is-hero__pair">
          <div>
            <span className="ka-po-cap">ใบที่ค้างชำระ</span>
            <b className="numeric">{statsReady ? count(summary.open.count) : '–'}</b>
          </div>
          <div>
            <span className="ka-po-cap">จ่ายแล้วเดือนนี้</span>
            <b className="numeric text-[var(--success)]">{statsReady ? formatBaht(summary.paid.amount) : '–'}</b>
          </div>
        </div>
      </section>

      <ReceiptQueue canAdd={canAdd} refreshKey={refreshKey} onIssue={issue} opening={opening} />

      <section className="ka-card ka-po-clip" aria-labelledby="is-list-title">
        <div className="ka-po-chd">
          <h2 id="is-list-title" className="ka-po-h2">ใบชำระหนี้</h2>
          <div className="ka-po-search">
            <Icon d={ICONS.search} />
            <input
              type="search"
              className="ka-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="เลขที่ ชื่อเอกสาร ผู้จัดจำหน่าย"
              aria-label="ค้นหาใบชำระหนี้ด้วยเลขที่ ชื่อเอกสาร ผู้จัดจำหน่าย หรือเลขที่ใบรับสินค้า"
            />
          </div>
        </div>
        <div className="ka-is-chips" role="group" aria-label="กรองตามสถานะ">
          {chips.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={statusFilter === key}
              onClick={() => {
                setStatusFilter(key);
                setPage(1);
              }}
            >
              {chipLabel(key)}
              <span className="numeric">{chipsLoading ? '–' : chipCount(key).toLocaleString('th-TH')}</span>
            </button>
          ))}
        </div>

        {capped && (
          <p className="ka-po-cap ka-po-cp !py-2" role="note">
            การ์ดสรุป ตัวนับสถานะ และตัวกรองสถานะ คิดจาก {LOCAL_LIMIT.toLocaleString('th-TH')} ใบล่าสุด ส่วนรายการ “ทั้งหมด” ค้นหาได้ทุกใบ
          </p>
        )}

        <div aria-busy={loading || undefined}>
          {listError && (
            <div className="ka-po-cp">
              <LoadErrorBanner message={listError} onRetry={retryList} />
            </div>
          )}

          {!listError && (loading || pageRows.length > 0) && (
            <>
              <div className="ka-po-tw ka-po-tw--list">
                <table className={`ka-po-lt ka-is-lt${loading ? ' ka-po-lt--loading' : ''}`}>
                  <caption className="sr-only">ใบชำระหนี้ หน้า {shownPage}</caption>
                  <thead>
                    <tr>
                      <th scope="col">เลขที่ / ผู้จัดจำหน่าย</th>
                      <th scope="col" className="ka-is-lg">อ้างอิงใบรับสินค้า</th>
                      <th scope="col" className="ka-is-lg" aria-sort={ariaSort('invoice_supplier_date')}>{sortButton('invoice_supplier_date', 'วันที่เอกสาร')}</th>
                      <th scope="col" aria-sort={ariaSort('invoice_supplier_due_date')}>{sortButton('invoice_supplier_due_date', 'ครบกำหนด')}</th>
                      <th scope="col">สถานะ</th>
                      <th scope="col" className="ka-po-r ka-is-amtcol" aria-sort={ariaSort('invoice_supplier_total')}>{sortButton('invoice_supplier_total', 'ยอด / ชำระแล้ว')}</th>
                      <th scope="col" className="ka-is-actcol"><span className="sr-only">การทำงาน</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && pageRows.length === 0
                      ? Array.from({ length: 4 }, (_, index) => (
                          <tr key={index} aria-hidden="true">
                            <td colSpan={7}><span className="ka-skel" /></td>
                          </tr>
                        ))
                      : pageRows.map((view) => {
                          const note = dueNote(view);
                          const pct = paidPercent(view.total, view.paid);
                          const code = view.row.invoice_supplier_code;
                          return (
                            <tr key={view.row.invoice_supplier_id}>
                              <td>
                                <button type="button" className="ka-po-rowlink text-left font-[inherit]" onClick={() => openInvoice(view, 'view')} disabled={opening !== null}>
                                  <span className="ka-po-code"><DocumentCode code={code} legacyCode={view.row.legacy_code} search={query} /></span>
                                  <span className="sr-only"> ดูรายละเอียด</span>
                                </button>
                                <span className="ka-is-sub">{view.supplierName}</span>
                                <span className="ka-is-sub ka-is-md numeric">อ้างอิง {view.receiptCode} · {formatThaiDate(view.row.invoice_supplier_date)}</span>
                              </td>
                              <td className="ka-is-lg ka-po-code ka-po-code--muted">{view.receiptCode}</td>
                              <td className="ka-is-lg numeric ka-po-nowrap">{formatThaiDate(view.row.invoice_supplier_date)}</td>
                              <td className="numeric ka-po-nowrap">
                                {formatThaiDate(view.row.invoice_supplier_due_date)}
                                {note.text && <span className="ka-is-note" data-tone={note.tone === 'muted' ? undefined : note.tone}>{note.text}</span>}
                              </td>
                              <td>
                                <StatusBadge tone={DISPLAY_STATUS_TONES[view.status]}>{DISPLAY_STATUS_LABELS[view.status]}</StatusBadge>
                              </td>
                              <td className="ka-po-r">
                                <span className="numeric ka-po-amt">{formatMoney(view.total)}</span>
                                <span className="ka-is-bar" data-full={pct >= 100 || undefined} aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
                                <span className="ka-is-sub numeric">ชำระ {formatBaht(view.paid)}</span>
                              </td>
                              <td>
                                <div className="ka-is-acts">
                                  <button type="button" className="ka-btn ka-btn--ghost ka-btn--icon ka-is-lg" aria-label={`ดูรายละเอียด ${code}`} onClick={() => openInvoice(view, 'view')} disabled={opening !== null}>
                                    <Icon d={ICONS.eye} className="h-[18px] w-[18px]" />
                                  </button>
                                  {canEdit && (
                                    <button type="button" className="ka-btn ka-btn--ghost ka-btn--icon ka-is-lg" aria-label={`แก้ไข ${code}`} onClick={() => openInvoice(view, 'edit')} disabled={opening !== null}>
                                      <Icon d={ICONS.edit} className="h-[18px] w-[18px]" />
                                    </button>
                                  )}
                                  <span className="ka-is-md text-[var(--ink-muted)]" aria-hidden="true"><Icon d={ICONS.chevron} className="h-[18px] w-[18px]" /></span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              <ul className="ka-po-mlist" aria-label="ใบชำระหนี้">
                {pageRows.map((view) => {
                  const note = dueNote(view);
                  const pct = paidPercent(view.total, view.paid);
                  return (
                    <li key={view.row.invoice_supplier_id}>
                      <button type="button" className="ka-po-mc ka-is-mc w-full text-left font-[inherit]" onClick={() => openInvoice(view, 'view')} disabled={opening !== null}>
                        <span className="ka-po-mc__row">
                          <span className="min-w-0">
                            <span className="ka-po-code block"><DocumentCode code={view.row.invoice_supplier_code} legacyCode={view.row.legacy_code} search={query} /></span>
                            <span className="ka-po-cap ka-po-mc__meta">{view.supplierName}</span>
                          </span>
                          <StatusBadge tone={DISPLAY_STATUS_TONES[view.status]}>{DISPLAY_STATUS_LABELS[view.status]}</StatusBadge>
                        </span>
                        <span className="ka-po-mc__row">
                          <span className="ka-po-cap ka-po-mc__meta numeric">
                            ครบกำหนด {formatThaiDate(view.row.invoice_supplier_due_date)}
                            {note.text && <> · <span className="ka-is-note inline" data-tone={note.tone === 'muted' ? undefined : note.tone}>{note.text}</span></>}
                          </span>
                          <span className="numeric ka-po-mc__amt">{formatBaht(view.total)}</span>
                        </span>
                        <span className="ka-is-bar" data-full={pct >= 100 || undefined} aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
                        <span className="ka-po-mc__row ka-po-cap numeric">
                          <span>ชำระแล้ว {formatBaht(view.paid)}</span>
                          <span>คงเหลือ {formatBaht(view.remaining)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {nothingYet && (
            <div className="ka-po-empty">
              <p className="ka-po-empty__t">ยังไม่มีใบชำระหนี้</p>
              <p className="ka-po-cap">กด “ออกใบชำระหนี้” ที่ใบรับสินค้าด้านบน ใบที่บันทึกแล้วจะแสดงที่นี่</p>
            </div>
          )}

          {noMatch && (
            <div className="ka-po-empty">
              <p className="ka-po-empty__t">{query ? `ไม่พบใบชำระหนี้ที่ตรงกับ “${query}”` : `ไม่มีใบชำระหนี้สถานะ “${chipLabel(statusFilter)}”`}</p>
              <p className="ka-po-cap">ลองค้นด้วยคำอื่น หรือล้างตัวกรอง</p>
              {filteredBy && (
                <button
                  type="button"
                  className="ka-btn"
                  onClick={() => {
                    setSearchText('');
                    setQuery('');
                    setStatusFilter('all');
                    setPage(1);
                  }}
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          )}
        </div>

        {!listError && total > 0 && (
          <div className="ka-po-pager">
            <span className="ka-po-cap numeric" role="status">
              {lastPage > 1
                ? `แสดง ${from.toLocaleString('th-TH')}–${to.toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')} รายการ`
                : `แสดงครบ ${total.toLocaleString('th-TH')} รายการ`}
            </span>
            {lastPage > 1 && <Pagination meta={pagerMeta} currentPage={shownPage} onPageChange={setPage} />}
          </div>
        )}
      </section>

      {modal?.kind === 'create' && (
        <InvoiceForm
          key={modal.receipt.purchase_receipt_id}
          mode="create"
          isOpen
          receipt={modal.receipt}
          availablePayments={modal.accounts}
          onClose={() => setModal(null)}
          onSubmit={(payload) => handleCreate(modal.receipt, payload)}
        />
      )}

      {modal?.kind === 'edit' && currentView && (
        <InvoiceForm
          key={currentView.row.invoice_supplier_id}
          mode="edit"
          isOpen
          invoice={currentView.row}
          receiptCode={currentView.receiptCode}
          supplierName={currentView.supplierName}
          vatType={currentView.vatType}
          availablePayments={modal.accounts}
          onClose={() => setModal(null)}
          onSubmit={(payload) => handleUpdate(currentView, payload)}
          onDelete={canDelete ? () => setToDelete(currentView) : undefined}
        />
      )}

      {modal?.kind === 'view' && currentView && (
        <InvoiceDetail
          isOpen
          view={currentView}
          availablePayments={modal.accounts}
          onClose={() => setModal(null)}
          onEdit={canEdit ? () => setModal({ ...modal, kind: 'edit' }) : undefined}
          onDelete={canDelete ? () => setToDelete(currentView) : undefined}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(toDelete) && canDelete}
        title="ลบใบชำระหนี้"
        message={`ลบ ${toDelete?.row.invoice_supplier_code ?? ''} พร้อมงวดชำระทั้งหมดของใบนี้ ถ้าใบรับสินค้า ${toDelete?.receiptCode ?? ''} ไม่มีใบชำระหนี้อื่น จะกลับไปรอออกใบชำระหนี้ ลบแล้วกู้คืนไม่ได้`}
        confirmLabel="ลบใบชำระหนี้"
        cancelLabel="ไม่ลบ"
        onCancel={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
