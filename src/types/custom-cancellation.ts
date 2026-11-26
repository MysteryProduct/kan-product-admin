// TASK-0217: cancelling a Custom request, as the employee routes answer.
// No amount is ever sent: the API works out what is owed back.

export type CustomCancellationStatus = 'pending' | 'approved' | 'rejected';
export type CustomProductionStage = 'not_started' | 'in_progress';

export interface CustomCancellation {
  id: string;
  customRequestId: string;
  status: CustomCancellationStatus;
  requestedBy: 'customer' | 'guest' | 'employee';
  reason: string;
  createdAt: string;
  refundAccount: { name: string | null; bank: string | null; number: string | null } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  // Set by the approval: where production stood, and the job it left behind.
  productionStage: CustomProductionStage | null;
  jobOrderId: string | null;
  jobOrderCode: string | null;
  paidAmount: number | null;
  refundAmount: number | null;
  // Approved, money owed, transfer not recorded yet.
  refundDue: boolean;
  refund: {
    reference: string;
    transferredAt: string;
    recordedAt: string;
    paymentReceiptId: string | null;
  } | null;
}

// What approving now would do. Read without locks; the decision reads again.
export interface CustomCancellationPreview {
  canRequest: boolean;
  blocked: 'cancelled' | 'produced' | null;
  productionStage?: CustomProductionStage;
  paidAmount?: number;
  refundAmount?: number;
}

export interface CustomCancellationView {
  customRequestId: string;
  canRequest: boolean;
  preview: CustomCancellationPreview;
  // The request that is pending or approved; a rejected one is only history.
  current: CustomCancellation | null;
  // Newest first.
  history: CustomCancellation[];
}

export interface CustomCancellationQueueItem extends CustomCancellation {
  customRequestCode: string;
  saleOrderId: string;
  saleOrderCode: string;
  buyerName: string;
}

export interface CustomCancellationQueue {
  data: CustomCancellationQueueItem[];
  meta: { total: number; page: number; limit: number; last_page: number };
}

export interface RequestCustomCancellationDto {
  reason: string;
  refund_account_name?: string;
  refund_account_bank?: string;
  refund_account_number?: string;
}
