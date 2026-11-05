import type { BadgeTone } from '@/components/StatusBadge';
import { formatThaiDate, formatThaiDateTime, toLocalIsoDate } from '@/lib/date-format';
import {
  INVOICE_SUPPLIER_STATUS_TONE,
  PAYMENT_RECEIPT_STATUS_TONE,
  PURCHASE_ORDER_STATUS_TONE,
  SALE_ORDER_STATUS_TONE,
} from '@/lib/status-tones';

// TASK-0338: what the history dialog shows for each entry, as plain functions so they can be tested
// against the snapshots each module records (`historySnapshot` in the API services).

export type HistoryEntry = {
  document_history_id: string;
  action: string;
  actor_name: string;
  actor_id: string;
  supplier_names: Record<string, string>;
  purchase_order_codes: Record<string, string>;
  material_names: Record<string, string>;
  product_unit_names: Record<string, string>;
  reason: string | null;
  previous_value: Record<string, unknown> | null;
  next_value: Record<string, unknown> | null;
  created_at: string;
};

export type HistoryItem = {
  material_id?: string;
  product_name?: string;
  product_variant_id?: string | null;
  sale_order_list_id?: string;
  purchase_order_list_id?: string;
  job_order_id?: string | null;
  product_unit_id?: number;
  quantity?: number;
  returned_qty?: number;
  status?: string;
};

export const ACTIONS: Record<string, string> = { created: 'สร้างเอกสาร', updated: 'แก้ไขเอกสาร', approved: 'อนุมัติ', submitted: 'ส่งอนุมัติ', rejected: 'ปฏิเสธ', cancelled: 'ยกเลิก', returned: 'คืนสินค้า', refund_created: 'สร้างรายการคืนเงิน', status_changed: 'เปลี่ยนสถานะ', deleted: 'ลบเอกสาร', edit_paid: 'แก้ไขใบที่ชำระครบ', delete_paid: 'ลบใบที่ชำระครบ' };
export const STATUSES: Record<string, string> = { draft: 'ฉบับร่าง', pending: 'รออนุมัติ', active: 'ใช้งานอยู่', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธ', inactive: 'ยกเลิก', cancelled: 'ยกเลิก', partial: 'รับสินค้าบางส่วน', paid: 'ชำระแล้ว', refunded: 'คืนเงินแล้ว', partially_returned: 'คืนสินค้าบางส่วน', returned: 'คืนสินค้าแล้ว', in_progress: 'กำลังผลิต', completed: 'ผลิตเสร็จแล้ว' };
// Only fields with a label are shown, so prices and costs never appear.
export const LABELS: Record<string, string> = { purchase_order_name: 'ชื่อใบสั่งซื้อ', purchase_order_detail: 'รายละเอียด', purchase_order_status: 'สถานะใบสั่งซื้อ', purchase_receipt_detail: 'รายละเอียด', purchase_receipt_status: 'สถานะใบรับสินค้า', supplier_id: 'ผู้จัดจำหน่าย', purchase_order_id: 'ใบสั่งซื้ออ้างอิง', entry_date: 'วันที่รับสินค้า', tax_invoice_number: 'เลขที่ใบกำกับภาษี', tax_invoice_date: 'วันที่ใบกำกับภาษี', vat_type: 'รูปแบบ VAT', vat_rate: 'อัตรา VAT', sale_order_status: 'สถานะใบขาย', sale_order_type: 'ประเภทใบขาย', payment_receipt_type: 'ประเภทรายการรับชำระ', payment_status: 'สถานะการชำระ', job_order_status: 'สถานะงานผลิต', job_order_qty: 'จำนวนผลิต', job_order_defect_qty: 'จำนวนเสีย', employee_id: 'ผู้รับผิดชอบ', invoice_supplier_name: 'ชื่อเอกสาร', invoice_supplier_date: 'วันที่เอกสาร', invoice_supplier_due_date: 'วันที่ครบกำหนด', invoice_supplier_total: 'ยอดใบชำระหนี้', invoice_supplier_status: 'สถานะการชำระ', invoice_payments: 'งวดชำระ' };
// Supplier invoices reuse status words that mean something else on receipts (partial) (TASK-0329).
const INVOICE_STATUSES: Record<string, string> = { pending: 'รอชำระ', partial: 'ชำระบางส่วน', paid: 'ชำระแล้ว' };
// A sale order's partial and paid are about payment, not received goods (the words its own pages use).
const SALE_ORDER_STATUSES: Record<string, string> = { partial: 'ชำระบางส่วน', paid: 'ชำระครบแล้ว' };
const SALE_ORDER_TYPES: Record<string, string> = { order: 'ขายจากการสั่งซื้อ', online: 'ขายบนเว็บไซต์', store: 'หน้าร้านออนไลน์', custom: 'งานผลิต Custom' };

// ---------------------------------------------------------------- actions (D7)

export type ActionTone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export type ActionIcon = 'plus' | 'pencil' | 'check' | 'send' | 'swap' | 'return' | 'cash' | 'cross' | 'trash' | 'dot';

const ACTION_STYLE: Record<string, { tone: ActionTone; icon: ActionIcon }> = {
  created: { tone: 'brand', icon: 'plus' },
  updated: { tone: 'info', icon: 'pencil' },
  approved: { tone: 'success', icon: 'check' },
  submitted: { tone: 'info', icon: 'send' },
  status_changed: { tone: 'neutral', icon: 'swap' },
  returned: { tone: 'warning', icon: 'return' },
  refund_created: { tone: 'warning', icon: 'cash' },
  edit_paid: { tone: 'warning', icon: 'pencil' },
  rejected: { tone: 'danger', icon: 'cross' },
  cancelled: { tone: 'danger', icon: 'cross' },
  deleted: { tone: 'danger', icon: 'trash' },
  delete_paid: { tone: 'danger', icon: 'trash' },
};

/** The label, tone and icon of an action; one the dialog does not know keeps its own name with a plain dot. */
export function actionStyle(action: string): { label: string; tone: ActionTone; icon: ActionIcon } {
  const style = ACTION_STYLE[action] ?? { tone: 'neutral' as const, icon: 'dot' as const };
  return { label: ACTIONS[action] ?? action, ...style };
}

// ---------------------------------------------------------------- actors (R6, D2, D8)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The store records its own steps under this id (`STORE_SYSTEM_ACTOR` in the API). */
export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';
const AVATAR_TONES: ActionTone[] = ['brand', 'info', 'success', 'warning'];

export interface Actor {
  key: string;
  name: string;
  kind: 'person' | 'system' | 'unknown';
  initials: string;
  tone: ActionTone;
}

/**
 * Who did it. The API sends an employee's name, or the bare id when the actor is not an employee: the store
 * system, a store customer or a removed employee. An id is never shown (TASK-0115).
 */
export function actorOf(entry: Pick<HistoryEntry, 'actor_name' | 'actor_id'>): Actor {
  const name = (entry.actor_name ?? '').trim();
  const id = entry.actor_id ?? name;
  if (id === SYSTEM_ACTOR_ID || name === SYSTEM_ACTOR_ID) return { key: SYSTEM_ACTOR_ID, name: 'ระบบ', kind: 'system', initials: '', tone: 'neutral' };
  if (!name || UUID.test(name)) return { key: id || 'unknown', name: 'ลูกค้าหรือผู้ใช้ที่ไม่อยู่ในระบบ', kind: 'unknown', initials: '', tone: 'neutral' };
  // Latin names read best as word initials ("Demo Audit" → "DA"); Thai ones as their first two letters ("นภัส ศ." → "นภ").
  const words = name.split(/\s+/).filter(Boolean);
  const initials = /^[A-Za-z]/.test(name) && words.length > 1
    ? (words[0][0] + words[1][0]).toUpperCase()
    : Array.from(name.replace(/\s+/g, '')).slice(0, 2).join('');
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return { key: id || name, name, kind: 'person', initials, tone: AVATAR_TONES[hash % AVATAR_TONES.length] };
}

// ---------------------------------------------------------------- days (R4)

export interface DayGroup {
  key: string;
  label: string;
  entries: HistoryEntry[];
}

/** Entries grouped by the viewer's calendar day, in the order the API gave them (newest first). */
export function groupByDay(entries: HistoryEntry[], now: Date = new Date()): DayGroup[] {
  const today = toLocalIsoDate(now);
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const date = new Date(entry.created_at);
    const key = Number.isNaN(date.getTime()) ? 'unknown' : toLocalIsoDate(date);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const day = key === 'unknown' ? 'ไม่ทราบวันที่' : formatThaiDate(date);
      group = { key, label: key === today ? `วันนี้ · ${day}` : day, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

const timeFormat = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
/** The time of day, `HH:mm`, for an entry under its day heading. */
export function timeOf(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : timeFormat.format(date);
}

// ---------------------------------------------------------------- fields (R8, D9, D10)

// Job orders have no shared tone map; these follow the same rule as the others (waiting / in progress / done / cancelled).
const JOB_ORDER_STATUS_TONE: Record<string, BadgeTone> = { pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'danger' };

const STATUS_TONES: Record<string, Record<string, BadgeTone>> = {
  sale_order_status: SALE_ORDER_STATUS_TONE,
  purchase_order_status: PURCHASE_ORDER_STATUS_TONE,
  purchase_receipt_status: PURCHASE_ORDER_STATUS_TONE,
  invoice_supplier_status: INVOICE_SUPPLIER_STATUS_TONE,
  payment_status: PAYMENT_RECEIPT_STATUS_TONE,
  job_order_status: JOB_ORDER_STATUS_TONE,
};

/** The tone of a status value; a field or value with no tone map is neutral. */
export function statusTone(key: string, value: unknown): BadgeTone {
  return STATUS_TONES[key]?.[String(value)] ?? 'neutral';
}

function moneyText(value: unknown) {
  return `฿${Number(value ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === '';
}

/** A field value in words, or null when there is none. */
export function displayValue(value: unknown, key: string, entry: Pick<HistoryEntry, 'supplier_names' | 'purchase_order_codes'>): string | null {
  if (isEmpty(value)) return null;
  if (key === 'invoice_supplier_status') return INVOICE_STATUSES[String(value)] ?? String(value);
  if (key === 'invoice_supplier_total') return moneyText(value);
  if (key === 'invoice_payments' && Array.isArray(value)) {
    const sum = value.reduce<number>((total, round) => total + Number((round as { invoice_payment_price?: unknown }).invoice_payment_price ?? 0), 0);
    return `${value.length.toLocaleString('th-TH')} งวด · ${moneyText(sum)}`;
  }
  if (key === 'invoice_supplier_date' || key === 'invoice_supplier_due_date') return formatThaiDate(String(value));
  if (key === 'supplier_id') return entry.supplier_names?.[String(value)] ?? null;
  if (key === 'purchase_order_id') return entry.purchase_order_codes?.[String(value)] ?? null;
  if (key === 'sale_order_type') return SALE_ORDER_TYPES[String(value)] ?? String(value);
  if (key === 'sale_order_status') return SALE_ORDER_STATUSES[String(value)] ?? STATUSES[String(value)] ?? String(value);
  if (key.endsWith('_status')) return STATUSES[String(value)] ?? String(value);
  if (key === 'vat_type') return ({ none: 'ไม่มี VAT', include: 'รวม VAT', exclude: 'แยก VAT' } as Record<string, string>)[String(value)] ?? String(value);
  if (key === 'entry_date' || key === 'tax_invoice_date') return formatThaiDateTime(String(value));
  // An id with no name to show stays hidden rather than printed (TASK-0115).
  if (typeof value === 'string' && UUID.test(value)) return null;
  return String(value);
}

export interface FieldChange {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
  /** A status field: both sides are drawn as status badges in these tones. */
  status: boolean;
  beforeTone: BadgeTone;
  afterTone: BadgeTone;
}

/** The labelled fields that changed; a value set for the first time shows alone (the status reads "สถานะเริ่มต้น"). */
export function fieldChanges(entry: HistoryEntry): FieldChange[] {
  const before = entry.previous_value ?? {};
  const after = entry.next_value ?? {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => LABELS[key] && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => {
      const status = key.endsWith('_status');
      const beforeText = displayValue(before[key], key, entry);
      const afterText = displayValue(after[key], key, entry);
      return {
        key,
        label: status && beforeText === null ? 'สถานะเริ่มต้น' : LABELS[key],
        before: beforeText,
        after: afterText,
        status,
        beforeTone: statusTone(key, before[key]),
        afterTone: statusTone(key, after[key]),
      };
    })
    .filter((change) => change.before !== null || change.after !== null);
}

// ---------------------------------------------------------------- items (R9, D1)

export type ItemChangeKind = 'added' | 'removed' | 'qty' | 'status' | 'returned' | 'listed';

export interface ItemChange {
  kind: ItemChangeKind;
  name: string;
  /** The unit's name, or '' when the snapshot has none. */
  unit: string;
  quantity: number | null;
  previousQuantity?: number | null;
  /** Returned in this entry, out of `quantity` sold. */
  returned?: number;
  status?: { before: string | null; after: string | null; beforeTone: BadgeTone; afterTone: BadgeTone };
}

function itemsOf(value: Record<string, unknown> | null): HistoryItem[] | null {
  return Array.isArray(value?.items) ? (value.items as HistoryItem[]) : null;
}

/**
 * The key that follows one line across a change. A sale order is rebuilt with new line ids on every edit, so it
 * is followed by its variant, or by its job order and name; purchase and production lines by material and unit.
 */
export function itemKey(item: HistoryItem): string {
  if ('sale_order_list_id' in item || 'returned_qty' in item) {
    return item.product_variant_id ? `v:${item.product_variant_id}` : `j:${item.job_order_id ?? ''}|${item.product_name ?? ''}`;
  }
  return `m:${item.material_id ?? ''}|${item.product_unit_id ?? ''}|${item.purchase_order_list_id ?? ''}`;
}

function itemName(item: HistoryItem, entry: Pick<HistoryEntry, 'material_names'>): string {
  return item.product_name?.trim() || entry.material_names?.[item.material_id ?? ''] || 'ไม่ทราบรายการ';
}

function itemUnit(item: HistoryItem, entry: Pick<HistoryEntry, 'product_unit_names'>): string {
  return item.product_unit_id === undefined || item.product_unit_id === null ? '' : entry.product_unit_names?.[String(item.product_unit_id)] ?? '';
}

const quantityOf = (item: HistoryItem) => (item.quantity === undefined || item.quantity === null ? null : Number(item.quantity));

/** How the goods changed in one entry: a plain list when the document was created, otherwise each difference. */
export function itemChanges(entry: HistoryEntry): ItemChange[] {
  const previous = itemsOf(entry.previous_value);
  const next = itemsOf(entry.next_value);
  if (!next && !previous) return [];
  const describe = (item: HistoryItem, kind: ItemChangeKind): ItemChange => ({ kind, name: itemName(item, entry), unit: itemUnit(item, entry), quantity: quantityOf(item) });
  if (!previous || (previous.length === 0 && entry.action === 'created')) return (next ?? []).map((item) => describe(item, 'listed'));

  // Pair lines: the same line id first (a return keeps it), then the key; repeated keys pair in order.
  const unmatched = [...previous];
  const pairs: [HistoryItem, HistoryItem][] = [];
  const added: HistoryItem[] = [];
  for (const item of next ?? []) {
    let index = item.sale_order_list_id ? unmatched.findIndex((old) => old.sale_order_list_id === item.sale_order_list_id) : -1;
    if (index < 0) index = unmatched.findIndex((old) => itemKey(old) === itemKey(item));
    if (index < 0) added.push(item);
    else pairs.push([unmatched.splice(index, 1)[0], item]);
  }

  // Added lines first, then changed ones, then removed ones (the artboard's order).
  const changes: ItemChange[] = added.map((item) => describe(item, 'added'));
  for (const [old, item] of pairs) {
    const returnedNow = Number(item.returned_qty ?? 0) - Number(old.returned_qty ?? 0);
    if (returnedNow > 0) changes.push({ ...describe(item, 'returned'), returned: returnedNow });
    if (quantityOf(old) !== quantityOf(item)) changes.push({ ...describe(item, 'qty'), previousQuantity: quantityOf(old) });
    if ((old.status ?? null) !== (item.status ?? null)) {
      changes.push({
        ...describe(item, 'status'),
        status: {
          before: old.status ? STATUSES[old.status] ?? old.status : null,
          after: item.status ? STATUSES[item.status] ?? item.status : null,
          beforeTone: statusTone('purchase_order_status', old.status),
          afterTone: statusTone('purchase_order_status', item.status),
        },
      });
    }
  }
  changes.push(...unmatched.map((item) => describe(item, 'removed')));
  return changes;
}

// ---------------------------------------------------------------- summary (R2, D3)

export interface HistorySummary {
  total: number;
  loaded: number;
  allLoaded: boolean;
  actors: Actor[];
  first: string | null;
  last: string | null;
}

/** The header figures. Who and when are only told once every entry is loaded, so they are never partial. */
export function summarize(entries: HistoryEntry[], total: number, lastPage: number, page: number): HistorySummary {
  const allLoaded = page >= lastPage || entries.length >= total;
  const actors = new Map<string, Actor>();
  for (const entry of entries) {
    const actor = actorOf(entry);
    if (!actors.has(actor.key)) actors.set(actor.key, actor);
  }
  const dates = entries.map((entry) => entry.created_at).filter((value) => !Number.isNaN(new Date(value).getTime()));
  return {
    total,
    loaded: entries.length,
    allLoaded,
    actors: [...actors.values()],
    first: dates.length ? dates[dates.length - 1] : null,
    last: dates.length ? dates[0] : null,
  };
}

const dayMonth = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' });
/** "29 ต.ค. – 3 พ.ย. 2569": the year once when both ends share it; one day alone when they are the same day. */
export function rangeText(first: string, last: string): string {
  const from = new Date(first);
  const to = new Date(last);
  if (toLocalIsoDate(from) === toLocalIsoDate(to)) return formatThaiDate(to);
  if (from.getFullYear() === to.getFullYear()) return `${dayMonth.format(from)} – ${formatThaiDate(to)}`;
  return `${formatThaiDate(from)} – ${formatThaiDate(to)}`;
}
