import { PaginationMeta } from './pagination';

export type StoreLotStatus = 'unreleased' | 'released';

export interface StoreLot {
  stockProductId: string;
  productName: string;
  colorName: string | null;
  sizeName: string | null;
  /** The production job the lot came from (its name). */
  sourceName: string | null;
  quantity: number;
  remainingQty: number;
  producedAt: string;
  releasedAt: string | null;
  releasedBy: { employeeId: string; name: string | null } | null;
  releaseNote: string | null;
}

export interface StoreLotResponse {
  data: StoreLot[];
  meta: PaginationMeta;
}

export interface ReleasedStoreLot extends StoreLot {
  /** True when someone else had already released the lot. */
  alreadyReleased: boolean;
}
