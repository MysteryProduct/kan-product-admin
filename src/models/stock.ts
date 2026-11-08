import axiosInstance from '@/lib/axios';

export type StockKind = 'material' | 'product';

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  last_page: number;
}

export interface Paged<T> {
  data: T[];
  meta: ListMeta;
}

export interface StockOverview {
  defaultThreshold: number;
  items: number;
  normal: number;
  low: number;
  out: number;
  /** Null when no lot has a cost: shown as "ไม่มีต้นทุน", never as 0. */
  stockValue: number | null;
}

export type StockStatus = 'normal' | 'low' | 'out';

export interface StockItem {
  id: string;
  code: string;
  name: string;
  colorName: string | null;
  sizeName: string | null;
  unitName: string | null;
  remainQty: number;
  reservedQty: number;
  availableQty: number;
  /** Products only. */
  pendingReleaseQty?: number;
  incomingQty: number;
  stockValue: number;
  threshold: number;
  thresholdSource: 'default' | 'custom';
  status: StockStatus;
}

export interface StockLot {
  lotId: string;
  sourceId: string | null;
  sourceCode: string | null;
  sourceLabel: string;
  receivedAt: string;
  /** Grows with adjustments on products: never label it as the produced quantity. */
  receivedQty: number;
  remainQty: number;
  reservedQty: number;
  unitCost: number;
  lotStatus: string;
  released?: boolean;
  releasedAt?: string | null;
}

export interface StockDocument {
  documentType: string;
  documentId: string;
  documentCode: string;
  documentDate: string;
  qty: number;
}

export interface StockItemDetail extends StockItem {
  lots: StockLot[];
  reservations: StockDocument[];
  incoming: StockDocument[];
}

export type StockMovementGroup = 'in' | 'out' | 'reserve' | 'adjust';

export interface StockMovement {
  stockMovementId: string;
  movementType: string;
  group: StockMovementGroup | null;
  itemId: string;
  itemName: string;
  itemCode: string | null;
  colorName: string | null;
  sizeName: string | null;
  remainDelta: number;
  reserveDelta: number;
  itemRemainAfter: number;
  itemReserveAfter: number;
  documentType: string | null;
  documentCode: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface StockMovementSummary {
  days: { date: string; in: number; out: number }[];
  totals: { in: number; out: number; reserveAdjust: number };
}

export type AdjustmentDirection = 'increase' | 'decrease';
export type AdjustmentReason = 'damaged' | 'lost' | 'count_mismatch' | 'other';
export type AdjustmentStatus = 'pending' | 'approved' | 'rejected';

export const ADJUSTMENT_REASONS: Record<AdjustmentReason, string> = {
  damaged: 'สินค้าเสียหาย',
  lost: 'สูญหาย',
  count_mismatch: 'นับไม่ตรง',
  other: 'อื่น ๆ',
};

export interface StockAdjustment {
  id: string;
  code: string;
  lotId: string;
  lotCode: string | null;
  lotLabel: string;
  itemCode: string | null;
  itemName: string;
  colorName: string | null;
  sizeName: string | null;
  direction: AdjustmentDirection;
  qty: number;
  reason: AdjustmentReason;
  detail: string | null;
  status: AdjustmentStatus;
  /** The lot's figures, live while pending and kept once decided. */
  remainBefore: number;
  remainAfter: number;
  requestedByName: string;
  requestedAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  rejectReason: string | null;
  countCode: string | null;
}

export type CountScope = 'all' | 'low' | 'selected';
export type CountStatus = 'counting' | 'reviewing' | 'closed';

export const COUNT_SCOPES: Record<CountScope, string> = {
  all: 'ทั้งหมด',
  low: 'เฉพาะเหลือน้อยและหมด',
  selected: 'เลือกรายการเอง',
};

export interface CountRound {
  id: string;
  code: string;
  scope: CountScope;
  hideSystemQty: boolean;
  status: CountStatus;
  openedByName: string;
  openedAt: string;
  submittedAt: string | null;
  closedAt: string | null;
  itemCount: number;
  countedCount: number;
}

/** Which fields arrive depends on the round's status and the reader's rights (TASK-0364 Q11, Q12). */
export interface CountLine {
  id: string;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  colorName: string | null;
  sizeName: string | null;
  unitName: string | null;
  countedQty?: number | null;
  countedAt?: string | null;
  /** Only on an unhidden round being counted. */
  systemQty?: number;
  openingQty?: number;
  reason?: AdjustmentReason | null;
  detail?: string | null;
  movementQty?: number;
  expectedQty?: number;
  diffQty?: number;
  /** Null is "ไม่มีต้นทุน", never 0. */
  diffValue?: number | null;
  blockedReason?: string | null;
  lots?: { lotId: string; direction: AdjustmentDirection; qty: number; unitCost: number | null; adjustmentCode: string | null }[];
}

export interface CountDetail {
  id: string;
  code: string;
  scope: CountScope;
  hideSystemQty: boolean;
  status: CountStatus;
  summary?: { matched: number; short: number; over: number; netValue: number; noCost: number };
  items: CountLine[];
}

export const countItemLabel = (line: Pick<CountLine, 'itemName' | 'colorName' | 'sizeName'>) =>
  [line.itemName, line.colorName, line.sizeName].filter(Boolean).join(' · ');

/** Thai names of the ledger's movement types; an unknown type must not show its raw key. */
export const MOVEMENT_LABELS: Record<string, string> = {
  receive: 'รับเข้า',
  produce: 'ผลิตเข้า',
  return: 'คืนสินค้า',
  consume: 'ตัดออก',
  receive_reverse: 'ย้อนรับเข้า',
  reserve: 'จอง',
  unreserve: 'คืนยอดจอง',
  reserve_transfer: 'ย้ายจอง',
  adjust: 'ปรับยอด',
};

class StockModel {
  async getItem(kind: StockKind, id: string): Promise<StockItemDetail> {
    const response = await axiosInstance.get<StockItemDetail>(`/stock-level/${kind}/${id}`);
    return response.data;
  }

  async setThreshold(kind: StockKind, id: string, threshold: number | null): Promise<void> {
    await axiosInstance.patch(`/stock-level/${kind}/${id}/threshold`, { threshold });
  }

  async listMovements(
    kind: StockKind,
    params: {
      item_id?: string;
      group?: StockMovementGroup;
      date_from?: string;
      date_to?: string;
      page: number;
      limit: number;
    },
  ): Promise<Paged<StockMovement>> {
    const response = await axiosInstance.get<Paged<StockMovement>>(`/stock-movement/${kind}`, { params });
    return response.data;
  }

  async getMovementSummary(kind: StockKind, itemId?: string): Promise<StockMovementSummary> {
    const response = await axiosInstance.get<StockMovementSummary>(`/stock-movement/${kind}/summary`, {
      params: { item_id: itemId },
    });
    return response.data;
  }

  async listItems(
    kind: StockKind,
    params: { q?: string; status?: StockStatus; page: number; limit: number },
  ): Promise<Paged<StockItem>> {
    const response = await axiosInstance.get<Paged<StockItem>>(`/stock-level/${kind}`, { params });
    return response.data;
  }

  async getOverview(kind: StockKind): Promise<StockOverview> {
    const response = await axiosInstance.get<StockOverview>(`/stock-level/${kind}/overview`);
    return response.data;
  }

  async listAdjustments(
    kind: StockKind,
    params: { status?: AdjustmentStatus; page: number; limit: number },
  ): Promise<Paged<StockAdjustment>> {
    const response = await axiosInstance.get<Paged<StockAdjustment>>(`/stock-adjustment/${kind}`, { params });
    return response.data;
  }

  async createAdjustment(
    kind: StockKind,
    body: { lotId: string; direction: AdjustmentDirection; qty: number; reason: AdjustmentReason; detail?: string },
  ): Promise<{ code: string }> {
    const response = await axiosInstance.post<{ code: string }>(`/stock-adjustment/${kind}`, body);
    return response.data;
  }

  async approveAdjustment(kind: StockKind, id: string): Promise<void> {
    await axiosInstance.post(`/stock-adjustment/${kind}/${id}/approve`);
  }

  async rejectAdjustment(kind: StockKind, id: string, reason: string): Promise<void> {
    await axiosInstance.post(`/stock-adjustment/${kind}/${id}/reject`, { reason });
  }

  /** `add` alone reads the same rounds through `/sheets`. */
  async listRounds(
    kind: StockKind,
    params: { status?: CountStatus; page: number; limit: number },
    canView: boolean,
  ): Promise<Paged<CountRound>> {
    const path = `/stock-count/${kind}${canView ? '' : '/sheets'}`;
    const response = await axiosInstance.get<Paged<CountRound>>(path, { params });
    return response.data;
  }

  /** The whole round: the sheet filters and the review totals need every item, and a page holds 100. */
  async getRound(kind: StockKind, id: string, canView: boolean): Promise<CountDetail> {
    const path = `/stock-count/${kind}/${id}${canView ? '' : '/sheet'}`;
    type Answer = Omit<CountDetail, 'items'> & { items: Paged<CountLine> };
    const read = (page: number) =>
      axiosInstance.get<Answer>(path, { params: { page, limit: 100 } }).then((response) => response.data);
    const first = await read(1);
    const pages = Array.from({ length: Math.max(0, first.items.meta.last_page - 1) }, (_, index) => index + 2);
    const rest = await Promise.all(pages.map(read));
    return { ...first, items: [first, ...rest].flatMap((answer) => answer.items.data) };
  }

  async openRound(
    kind: StockKind,
    body: { scope: CountScope; hideSystemQty: boolean; itemIds?: string[] },
  ): Promise<{ id: string; code: string }> {
    const response = await axiosInstance.post<{ id: string; code: string }>(`/stock-count/${kind}`, body);
    return response.data;
  }

  async saveCount(kind: StockKind, id: string, itemId: string, countedQty: number): Promise<void> {
    await axiosInstance.put(`/stock-count/${kind}/${id}/items/${itemId}/count`, { countedQty });
  }

  async submitRound(kind: StockKind, id: string): Promise<void> {
    await axiosInstance.post(`/stock-count/${kind}/${id}/submit`);
  }

  async saveCountReason(
    kind: StockKind,
    id: string,
    itemId: string,
    reason: AdjustmentReason,
    detail: string,
  ): Promise<void> {
    await axiosInstance.put(`/stock-count/${kind}/${id}/items/${itemId}/reason`, {
      reason,
      ...(detail ? { detail } : {}),
    });
  }

  async recountRound(kind: StockKind, id: string, itemIds: string[]): Promise<void> {
    await axiosInstance.post(`/stock-count/${kind}/${id}/recount`, { itemIds });
  }

  async closeRound(kind: StockKind, id: string): Promise<{ adjustmentCodes: string[] }> {
    const response = await axiosInstance.post<{ adjustmentCodes: string[] }>(`/stock-count/${kind}/${id}/close`);
    return response.data;
  }

  /** How many adjustment requests match, without reading their rows. */
  async countAdjustments(kind: StockKind, status?: string): Promise<number> {
    const response = await axiosInstance.get<Paged<unknown>>(`/stock-adjustment/${kind}`, {
      params: { status, page: 1, limit: 1 },
    });
    return response.data.meta.total;
  }

  /** How many count rounds match, without reading their rows. */
  async countRounds(kind: StockKind, status: string, canView = true): Promise<number> {
    const path = `/stock-count/${kind}${canView ? '' : '/sheets'}`;
    const response = await axiosInstance.get<Paged<unknown>>(path, {
      params: { status, page: 1, limit: 1 },
    });
    return response.data.meta.total;
  }
}

export default StockModel;
