// TASK-0210: the shop's review of the files a customer sent through LINE OA.
// Shapes follow kan-product-api `custom-review.service.ts` (list, detail).

export const REVIEW_STATUSES = [
  'awaiting_line_files',
  'reviewing',
  'needs_changes',
  'approved_for_production',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type ReviewOutcome = 'received' | 'needs_changes' | 'approved';

export interface ReviewQueueRow {
  id: string;
  code: string;
  saleOrderId: string;
  saleOrderCode: string;
  status: ReviewStatus;
  revision: number;
  buyerName: string;
  itemCount: number;
  total: number;
  updatedAt: string;
  lastReview: { outcome: ReviewOutcome; at: string } | null;
}

export interface ReviewQueueResponse {
  data: ReviewQueueRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    last_page: number;
    counts: Record<ReviewStatus, number>;
  };
}

/** A layer as the Store stored it: metadata only, never image bytes. */
export type DesignLayer =
  | { layer_id?: string; kind: 'image'; file_name?: string; width?: number; height?: number }
  | { layer_id?: string; kind: 'text'; text?: string }
  | { layer_id?: string; kind?: string };

export interface ReviewItem {
  itemNo: number;
  templateCode: string;
  templateRevision: number;
  templateName: string;
  saleUnit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  options: { group: string; value: string }[];
  imageLayers: number;
  textLayers: number;
  design: { selections?: Record<string, string>; layers?: DesignLayer[] };
}

export interface ReviewHistoryEntry {
  outcome: ReviewOutcome;
  revision: number;
  reason: string | null;
  reviewedAt: string;
  reviewer: string | null;
}

export interface ReviewDetail {
  requestId: string;
  code: string;
  saleOrderCode: string;
  /** `cancelled` when the sale order was cancelled; otherwise the request's own status (custom_request CHECK). */
  status:
    | ReviewStatus
    | 'cancelled'
    | 'awaiting_deposit'
    | 'in_production'
    | 'produced'
    | 'awaiting_balance'
    | 'ready_to_ship'
    | 'shipped';
  revision: number;
  subtotal: number;
  shippingFee: number;
  vatRate: number;
  total: number;
  depositRequired: number;
  depositPaid: number;
  outstanding: number;
  buyer: { name: string; phone: string };
  recipient: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    district: string;
    province: string;
    postalCode: string;
  };
  note: string | null;
  items: ReviewItem[];
  saleOrderId: string;
  approvedRevision: number | null;
  hasJobOrder: boolean;
  reviews: ReviewHistoryEntry[];
}
