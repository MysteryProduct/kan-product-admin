import type { PaginationMeta } from '@/types/pagination';

/** The three groups of the page "งาน Custom หลังผลิต"; also the `group` query value. */
export type PostProductionGroup = 'awaiting_balance' | 'ready_to_ship' | 'shipped';

/** One Custom request after production (GET /sale-order/custom/post-production). */
export interface PostProductionRow {
  id: string;
  /** The request code, CU… */
  code: string;
  saleOrderId: string;
  saleOrderCode: string;
  /** The request's own status. The page's badge follows `group`, not this. */
  status: string;
  group: PostProductionGroup;
  buyerName: string;
  total: number;
  paid: number;
  outstanding: number;
  /** Null until the sale order was sent to the parcel page. */
  storeOrderId: string | null;
  pieces: number;
  shippedPieces: number;
  openParcels: number;
  /** A shipped parcel came back and its pieces wait to be sent again. */
  awaitingResend: boolean;
  updatedAt: string;
}

export type PostProductionCounts = Record<PostProductionGroup, number>;

export interface PostProductionList {
  data: PostProductionRow[];
  /** `counts` answers the same search for all three groups. */
  meta: PaginationMeta & { counts: PostProductionCounts };
}
