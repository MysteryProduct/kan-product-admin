// TASK-0210: pure helpers of the Custom file-review page (no DOM, no network).
import type { DesignLayer, ReviewDetail, ReviewItem, ReviewOutcome, ReviewStatus } from '@/types/custom-review';

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  awaiting_line_files: 'รอไฟล์จาก LINE',
  reviewing: 'กำลังตรวจ',
  needs_changes: 'ขอให้แก้',
  approved_for_production: 'อนุมัติผลิตแล้ว',
};

/** Dot colour of each status (v2 brief: a dot and a word, no filled badge). */
export const STATUS_DOT: Record<ReviewStatus, 'wn' | 'inf' | 'dg' | 'ok'> = {
  awaiting_line_files: 'wn',
  reviewing: 'inf',
  needs_changes: 'dg',
  approved_for_production: 'ok',
};

export const FILTERS: { key: ReviewStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'awaiting_line_files', label: 'รอไฟล์' },
  { key: 'reviewing', label: 'กำลังตรวจ' },
  { key: 'needs_changes', label: 'ขอให้แก้' },
  { key: 'approved_for_production', label: 'อนุมัติแล้ว' },
];

export const OUTCOME_LABEL: Record<ReviewOutcome, string> = {
  received: 'ได้รับไฟล์',
  needs_changes: 'ขอให้แก้',
  approved: 'อนุมัติ',
};

export const OUTCOME_DOT: Record<ReviewOutcome, 'inf' | 'dg' | 'ok'> = {
  received: 'inf',
  needs_changes: 'dg',
  approved: 'ok',
};

export const isQueueStatus = (s: string): s is ReviewStatus =>
  s === 'awaiting_line_files' || s === 'reviewing' || s === 'needs_changes' || s === 'approved_for_production';

/** Statuses outside the queue. The five after approval use the Store's words (kan-product-store custom-checkout-status.tsx); awaiting_deposit and cancelled keep the Admin's staff wording. */
const OTHER_STATUS: Record<string, { label: string; dot: 'dg' | 'ok' }> = {
  awaiting_deposit: { label: 'รอมัดจำ', dot: 'dg' },
  cancelled: { label: 'ยกเลิกแล้ว', dot: 'dg' },
  in_production: { label: 'กำลังผลิต', dot: 'ok' },
  produced: { label: 'ผลิตเสร็จแล้ว', dot: 'ok' },
  awaiting_balance: { label: 'รอชำระส่วนที่เหลือ', dot: 'ok' },
  ready_to_ship: { label: 'พร้อมจัดส่ง', dot: 'ok' },
  shipped: { label: 'จัดส่งแล้ว', dot: 'ok' },
};

/** Word and dot of any request status; an unknown one shows as it is, never as another status. */
export function statusView(status: string): { label: string; dot: 'wn' | 'inf' | 'dg' | 'ok' } {
  if (isQueueStatus(status)) return { label: STATUS_LABEL[status], dot: STATUS_DOT[status] };
  return Object.hasOwn(OTHER_STATUS, status) ? OTHER_STATUS[status] : { label: status, dot: 'dg' };
}

/** The API refuses a search term longer than this (CustomReviewListQuery.q). */
export const SEARCH_MAX = 64;

const CU_CODE = /CU\d{12,}/i;

/**
 * What the queue searches for. A pasted chat file name such as
 * `CU202611100004_SO202611100011_rev1_order.pdf` is searched by its CU code;
 * the field itself keeps what was typed.
 */
export function searchTerm(raw: string): { term: string; fromFile: string | null } {
  const text = raw.trim();
  const match = text.match(CU_CODE);
  if (match && text.length > match[0].length) {
    return { term: match[0].toUpperCase(), fromFile: match[0].toUpperCase() };
  }
  return { term: text.slice(0, SEARCH_MAX), fromFile: null };
}

/** The name every file of the set starts with: request, sale order and revision (Store `exportCode`). */
export const fileBase = (r: Pick<ReviewDetail, 'code' | 'saleOrderCode' | 'revision'>) =>
  `${r.code}_${r.saleOrderCode}_rev${r.revision}`;

/** Store `safeName` (kan-product-store src/lib/custom-export.ts): a ZIP-safe file name. */
export function safeName(name: string, max = 80) {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  const dot = cleaned.lastIndexOf('.');
  const ext = dot > 0 && cleaned.length - dot <= 6 ? cleaned.slice(dot) : '';
  const stem = ext ? cleaned.slice(0, dot) : cleaned;
  return (stem.slice(0, Math.max(1, max - ext.length)) || 'file') + ext;
}

export interface LayerRow {
  no: number;
  kind: 'image' | 'text' | 'other';
  value: string;
  size: string | null;
}

export interface OriginalRow {
  itemNo: number;
  layerNo: number;
  path: string;
  size: string;
}

const px = (w?: number, h?: number) => (w && h ? `${w} × ${h}` : null);

export function layerRows(layers: DesignLayer[] = []): LayerRow[] {
  return layers.map((layer, i) => {
    if (layer.kind === 'image') {
      const l = layer as Extract<DesignLayer, { kind: 'image' }>;
      return { no: i + 1, kind: 'image', value: l.file_name ?? '-', size: px(l.width, l.height) };
    }
    if (layer.kind === 'text') {
      const l = layer as Extract<DesignLayer, { kind: 'text' }>;
      return { no: i + 1, kind: 'text', value: l.text ?? '', size: null };
    }
    return { no: i + 1, kind: 'other', value: '-', size: null };
  });
}

/**
 * The files the ZIP holds under `originals/`, exactly as the Store writes them
 * (`originalFiles` in kan-product-store src/lib/custom-export.ts): one per image
 * layer in stacking order, numbered among the image layers and zero-padded to
 * the count. The same picture placed twice is two files with the same name tail.
 */
export function originalRows(item: ReviewItem): OriginalRow[] {
  const layers = item.design?.layers ?? [];
  const images = layers
    .map((layer, i) => ({ layer, layerNo: i + 1 }))
    .filter(({ layer }) => layer.kind === 'image');
  const pad = String(images.length).length;
  return images.map(({ layer, layerNo }, i) => {
    const l = layer as Extract<DesignLayer, { kind: 'image' }>;
    return {
      itemNo: item.itemNo,
      layerNo,
      path: `originals/${String(i + 1).padStart(pad, '0')}_${safeName(l.file_name ?? 'file')}`,
      size: px(l.width, l.height) ?? '-',
    };
  });
}

export type GlbCheck = { kind: 'not-glb' } | { kind: 'match' } | { kind: 'other'; prefix: string };

/** Whether a picked file is the model of this request and revision, by name only (D8 proposal). */
export function checkGlbName(name: string, base: string): GlbCheck {
  if (!/\.glb$/i.test(name)) return { kind: 'not-glb' };
  if (name === `${base}_model.glb`) return { kind: 'match' };
  const prefix = name.replace(/(_model)?\.glb$/i, '');
  return { kind: 'other', prefix };
}

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 });
export const formatTHB = (n: number) => thb.format(n);

const dateTime = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateTimeShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatAt = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : dateTime.format(d);
};
export const formatAtShort = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : dateTimeShort.format(d);
};

/** The quick phrases offered for "ขอให้แก้" (D8 proposal); the reason stays free text. */
export const QUICK_REASONS = ['ZIP เปิดไม่ได้', 'ไฟล์ไม่ครบ 2 ไฟล์', 'ภาพต้นฉบับขาดหรือขนาดไม่ตรง', 'ชื่อไฟล์ไม่ตรงคำขอ'];

export const REASON_MAX = 500;

/** The reason with a quick phrase added, or null when it would pass the limit. */
export function addQuickReason(reason: string, phrase: string): string | null {
  const head = reason.replace(/\s+$/, '');
  const next = head ? `${head} · ${phrase}` : phrase;
  return next.length > REASON_MAX ? null : next;
}
