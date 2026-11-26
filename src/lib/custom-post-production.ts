import type { BadgeTone } from '@/components/StatusBadge';
import type {
  PostProductionGroup,
  PostProductionRow,
} from '@/types/custom-post-production';

// TASK-0212: the words and decisions of the page "งาน Custom หลังผลิต".

export const POST_PRODUCTION_PAGE_SIZE = 20;
/** The API refuses a longer `q`; the box stops at the same length. */
export const POST_PRODUCTION_SEARCH_MAX = 64;

/** The tiles, in the order work moves through them. */
export const POST_PRODUCTION_GROUPS: {
  group: PostProductionGroup;
  label: string;
  icon: 'clock' | 'truck' | 'check';
  tone: 'warning' | 'brand' | 'success';
}[] = [
  { group: 'awaiting_balance', label: 'รอยอดคงเหลือ', icon: 'clock', tone: 'warning' },
  { group: 'ready_to_ship', label: 'พร้อมจัดส่ง', icon: 'truck', tone: 'brand' },
  { group: 'shipped', label: 'ส่งแล้ว', icon: 'check', tone: 'success' },
];

/**
 * The badge follows the group, not the request's own status: a fully paid
 * request not yet sent to the parcel page keeps the status `awaiting_balance`
 * while it is ready to ship.
 */
export const POST_PRODUCTION_BADGE: Record<
  PostProductionGroup,
  { label: string; tone: BadgeTone }
> = {
  awaiting_balance: { label: 'รอชำระส่วนที่เหลือ', tone: 'warning' },
  ready_to_ship: { label: 'พร้อมจัดส่ง', tone: 'info' },
  shipped: { label: 'จัดส่งแล้ว', tone: 'success' },
};

/**
 * The query of one page. The API answers 400 to a parameter it does not know,
 * so only these are sent, and an empty search is left out.
 */
export function postProductionParams(
  group: PostProductionGroup,
  search: string,
  page: number,
  limit: number,
): Record<string, string | number> {
  const params: Record<string, string | number> = { group, page, limit };
  const q = search.trim().slice(0, POST_PRODUCTION_SEARCH_MAX);
  if (q) params.q = q;
  return params;
}

export interface PostProductionStep {
  /** What the request waits for inside its group; empty when the badge says it all. */
  note: string;
  /** The note is a warning: it gets the warning icon as well as the colour. */
  warning: boolean;
  /** Where the next step is done. Null when this person may not open that page. */
  link: { label: string; href: string; name: string } | null;
}

const saleOrderHref = (row: PostProductionRow) =>
  `/admin/sale-orders/${encodeURIComponent(row.saleOrderId)}`;

/**
 * The second line of a row and its one link. This page changes nothing itself:
 * the balance is received and the order is sent on the sale order page, parcels
 * are made on the parcel page.
 */
export function postProductionStep(
  row: PostProductionRow,
  canOpenFulfillment: boolean,
  /** Holds what the balance form needs; without it the link only opens the order. */
  canRecordPayment = true,
): PostProductionStep {
  const saleOrder = (label: string) => ({
    label,
    href: saleOrderHref(row),
    name: `${label} ${row.saleOrderCode}`,
  });
  if (row.group === 'awaiting_balance') {
    return {
      note: '',
      warning: false,
      link: saleOrder(canRecordPayment ? 'บันทึกรับชำระ' : 'เปิดใบสั่งขาย'),
    };
  }
  const progress = `ส่งแล้ว ${row.shippedPieces} จาก ${row.pieces} ชิ้น`;
  if (row.storeOrderId === null) {
    return {
      note: row.group === 'shipped' ? progress : 'ชำระครบ รอส่งเข้าหน้าจัดส่ง',
      warning: false,
      link: saleOrder('เปิดใบสั่งขาย'),
    };
  }
  const link = canOpenFulfillment
    ? {
        label: 'เปิดหน้าจัดส่ง',
        href: `/admin/store-fulfillment?orderId=${encodeURIComponent(row.storeOrderId)}`,
        name: `เปิดหน้าจัดส่ง คำขอ ${row.code}`,
      }
    : null;
  if (row.group === 'shipped') return { note: progress, warning: false, link };
  if (row.awaitingResend) return { note: 'พัสดุตีกลับ รอส่งซ้ำ', warning: true, link };
  if (row.shippedPieces > 0) return { note: progress, warning: false, link };
  // A parcel being packed is not one still to be made.
  if (row.openParcels > 0) return { note: 'มีพัสดุรอยืนยันจัดส่ง', warning: false, link };
  return { note: 'รอสร้างพัสดุ', warning: false, link };
}
