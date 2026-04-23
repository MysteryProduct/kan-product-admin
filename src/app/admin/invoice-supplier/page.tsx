'use client';

import { useEffect, useState } from 'react';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import LoadingSkeletonProps from '@/components/LoadingSkeleton';
import ActionResultDialog from '@/components/ActionResultDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { formatThaiDate } from '@/lib/date-format';
import { VAT_TYPE_LABELS } from '@/lib/vat';
import PurchaseReceiptModel from '@/models/purchase-receipt';
import SupplierModel from '@/models/supplier';
import InvoiceSupplierModel, { buildCreateDto, buildUpdateDto } from '@/models/invoice-supplier';
import { PurchaseReceipt, PurchaseReceiptResponse } from '@/types/purchase-receipt';
import { PaginationMeta } from '@/types/pagination';
import {
  InvoiceSupplierFormPayload,
  InvoiceSupplierListResponse,
  InvoiceSupplierPayment,
  InvoiceSupplierRow,
  INVOICE_STATUS_BADGE,
  INVOICE_STATUS_LABELS,
} from '@/types/invoice-supplier';
import InsertInvoiceSupplierForm from './components/insert';
import UpdateInvoiceSupplierForm from './components/update';
import InvoiceSupplierDetailModal from './components/detail';

const purchaseReceiptModel = new PurchaseReceiptModel();
const supplierModel = new SupplierModel();
const invoiceSupplierModel = new InvoiceSupplierModel();

type ApprovedSortField = 'entry_date' | 'purchase_receipt_total' | null;
type InvoiceSortField = 'invoice_supplier_date' | 'invoice_supplier_due_date' | 'invoice_supplier_total' | null;

type SortOrder = 'ASC' | 'DESC';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (value?: Date | string) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return formatThaiDate(date);
};

export default function InvoiceSupplierPage() {
  const { can } = usePermissions();
  const canAddInvoice = can('invoice_supplier', 'add');
  const canEditInvoice = can('invoice_supplier', 'edit');
  const canDeleteInvoice = can('invoice_supplier', 'delete');

  const [loading, setLoading] = useState(false);

  const [approvedSearchInput, setApprovedSearchInput] = useState('');
  const [approvedSearch, setApprovedSearch] = useState('');
  const [approvedPage, setApprovedPage] = useState(1);
  const [approvedMeta, setApprovedMeta] = useState<PaginationMeta | null>(null);
  const [approvedRows, setApprovedRows] = useState<PurchaseReceipt[]>([]);
  const [approvedSortField, setApprovedSortField] = useState<ApprovedSortField>(null);
  const [approvedSortOrder, setApprovedSortOrder] = useState<SortOrder>('DESC');

  const [invoiceRows, setInvoiceRows] = useState<InvoiceSupplierRow[]>([]);
  const [invoiceMeta, setInvoiceMeta] = useState<PaginationMeta | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceSortField, setInvoiceSortField] = useState<InvoiceSortField>('invoice_supplier_date');
  const [invoiceSortOrder, setInvoiceSortOrder] = useState<SortOrder>('DESC');
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedApprovedReceipt, setSelectedApprovedReceipt] = useState<PurchaseReceipt | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceSupplierRow | null>(null);
  const [availableSupplierPayments, setAvailableSupplierPayments] = useState<InvoiceSupplierPayment[]>([]);

  const [resultDialog, setResultDialog] = useState<{
    isOpen: boolean;
    status: 'success' | 'error';
    action: 'insert' | 'update' | 'delete';
    message: string;
  }>({
    isOpen: false,
    status: 'success',
    action: 'insert',
    message: '',
  });

  useEffect(() => {
    void fetchApprovedPurchaseReceipts();
  }, [approvedPage, approvedSearch, approvedSortField, approvedSortOrder]);

  useEffect(() => {
    void fetchInvoiceSuppliers();
  }, [invoicePage, invoiceSortField, invoiceSortOrder]);

  const fetchApprovedPurchaseReceipts = async () => {
    try {
      setLoading(true);
      const response: PurchaseReceiptResponse = await purchaseReceiptModel.getApprovedPurchaseReceiptsForInvoiceStatus(
        approvedPage,
        10,
        approvedSearch,
        approvedSortField,
        approvedSortOrder,
      );
      setApprovedRows(response.data || []);
      setApprovedMeta(response.meta || null);
    } catch (error) {
      console.error('Failed to fetch approved purchase receipts for invoice:', error);
      setApprovedRows([]);
      setApprovedMeta(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceSuppliers = async () => {
    try {
      setInvoiceLoading(true);
      const response: InvoiceSupplierListResponse = await invoiceSupplierModel.getInvoiceSuppliers(
        invoicePage,
        10,
        undefined,
        invoiceSortField,
        invoiceSortOrder,
      );
      setInvoiceRows(response.data || []);
      setInvoiceMeta(response.meta || null);
    } catch (error) {
      console.error('Failed to fetch invoice suppliers:', error);
      setInvoiceRows([]);
      setInvoiceMeta(null);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const getSupplierPayments = async (supplierId: string) => {
    try {
      const supplier = await supplierModel.getSupplierWithPaymentsById(supplierId);
      return (supplier.payments || []).map((payment) => ({
        payment_id: payment.payment_id,
        account_name: payment.account_name,
        account_number: payment.account_number,
        account_branch: payment.account_branch,
        bank_name: payment.bank_name,
      }));
    } catch (error) {
      console.error('Failed to fetch supplier payments:', error);
      return [];
    }
  };

  const enrichInvoiceRowWithSupplierPayments = async (row: InvoiceSupplierRow): Promise<InvoiceSupplierRow> => {
    const supplierId = row.supplier?.supplier_id || row.supplier_id;
    if (!supplierId) {
      return row;
    }

    const supplierPayments = await getSupplierPayments(supplierId);
    return {
      ...row,
      availablePayments: supplierPayments,
    };
  };

  const openInsertModal = async (receipt: PurchaseReceipt) => {
    if (!canAddInvoice) {
      return;
    }

    setLoading(true);
    const supplierPayments = await getSupplierPayments(receipt.supplier_id);
    setLoading(false);

    setSelectedApprovedReceipt(receipt);
    setAvailableSupplierPayments(supplierPayments);
    setIsInsertOpen(true);
  };

  const openUpdateModal = async (row: InvoiceSupplierRow) => {
    if (!canEditInvoice) {
      return;
    }

    setLoading(true);
    const nextRow = await enrichInvoiceRowWithSupplierPayments(row);
    setLoading(false);

    setSelectedInvoice(nextRow);
    setIsUpdateOpen(true);
  };

  const openDetailModal = async (row: InvoiceSupplierRow) => {
    setLoading(true);
    const nextRow = await enrichInvoiceRowWithSupplierPayments(row);
    setLoading(false);

    setSelectedInvoice(nextRow);
    setIsDetailOpen(true);
  };

  const handleInsertInvoice = async (payload: InvoiceSupplierFormPayload) => {
    if (!selectedApprovedReceipt) {
      setResultDialog({ isOpen: true, status: 'error', action: 'insert', message: 'ไม่พบใบรับสินค้าที่ต้องการสร้างใบชำระหนี้' });
      return;
    }

    try {
      setLoading(true);
      const dto = buildCreateDto(selectedApprovedReceipt.purchase_receipt_id, payload);

      await invoiceSupplierModel.createInvoiceSupplier(dto);
      setIsInsertOpen(false);
      setSelectedApprovedReceipt(null);
      setAvailableSupplierPayments([]);
      await Promise.all([fetchApprovedPurchaseReceipts(), fetchInvoiceSuppliers()]);
      setResultDialog({ isOpen: true, status: 'success', action: 'insert', message: 'เพิ่มใบชำระหนี้สำเร็จ' });
    } catch (error) {
      console.error('Failed to create invoice supplier:', error);
      setResultDialog({ isOpen: true, status: 'error', action: 'insert', message: 'เพิ่มใบชำระหนี้ไม่สำเร็จ กรุณาลองใหม่' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInvoice = async (payload: InvoiceSupplierFormPayload) => {
    if (!selectedInvoice) {
      return;
    }

    try {
      setLoading(true);
      const dto = buildUpdateDto(payload);
      await invoiceSupplierModel.updateInvoiceSupplier(selectedInvoice.invoice_supplier_id, dto);
      setIsUpdateOpen(false);
      setSelectedInvoice(null);
      await fetchInvoiceSuppliers();
      setResultDialog({ isOpen: true, status: 'success', action: 'update', message: 'แก้ไขใบชำระหนี้สำเร็จ' });
    } catch (error) {
      console.error('Failed to update invoice supplier:', error);
      setResultDialog({ isOpen: true, status: 'error', action: 'update', message: 'แก้ไขใบชำระหนี้ไม่สำเร็จ กรุณาลองใหม่' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) {
      return;
    }

    try {
      setLoading(true);
      await invoiceSupplierModel.deleteInvoiceSupplier(selectedInvoice.invoice_supplier_id);
      setIsDeleteOpen(false);
      setSelectedInvoice(null);
      await Promise.all([fetchApprovedPurchaseReceipts(), fetchInvoiceSuppliers()]);
      setResultDialog({ isOpen: true, status: 'success', action: 'delete', message: 'ลบใบชำระหนี้สำเร็จ' });
    } catch (error) {
      console.error('Failed to delete invoice supplier:', error);
      setResultDialog({ isOpen: true, status: 'error', action: 'delete', message: 'ลบใบชำระหนี้ไม่สำเร็จ กรุณาลองใหม่' });
    } finally {
      setLoading(false);
    }
  };


  const approvedColumns: DataTableColumn<PurchaseReceipt>[] = [
    {
      key: 'purchase_receipt_code' as keyof PurchaseReceipt,
      label: 'เลขที่ใบรับสินค้า',
      width: '220px',
      render: (_, row) => row.purchase_receipt_code || row.purchase_receipt_id,
    },
    {
      key: 'supplier_id',
      label: 'ผู้จัดจำหน่าย',
      render: (_, row) => row.supplier?.supplier_name || row.supplier_id,
    },
    {
      key: 'entry_date',
      label: 'วันที่รับสินค้า',
      sortable: true,
      render: (value) => formatDate(value as Date),
    },
    {
      key: 'vat_type',
      label: 'VAT',
      render: (value) => VAT_TYPE_LABELS[(value as PurchaseReceipt['vat_type']) || 'none'],
    },
    {
      key: 'purchase_receipt_total',
      label: 'ยอดรวมใบรับสินค้า',
      sortable: true,
      render: (value) => `฿${formatCurrency(Number(value || 0))}`,
    },
    {
      key: 'purchase_receipt_id',
      label: 'เพิ่มใบชำระหนี้',
      width: '180px',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => void openInsertModal(row)}
          disabled={!canAddInvoice}
          className="h-10 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          เพิ่มใบชำระหนี้
        </button>
      ),
    },
  ];

  const invoiceColumns: DataTableColumn<InvoiceSupplierRow>[] = [
    {
      key: 'invoice_supplier_code',
      label: 'เลขที่ใบชำระหนี้',
      width: '190px',
      render: (_, row) => (
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{row.invoice_supplier_code}</p>
          <p className="text-xs text-slate-500 dark:text-slate-300">{row.invoice_supplier_name}</p>
        </div>
      ),
    },
    {
      key: 'purchase_receipt_code',
      label: 'อ้างอิงใบรับสินค้า',
      render: (_, row) => (
        <div>
            <p className="text-slate-800 dark:text-slate-100">{row.purchaseReceipt?.purchase_receipt_code || row.purchaseReceipt?.purchase_receipt_id}</p>
        </div>
      ),
    },
    {
      key: 'supplier_name',
      label: 'ผู้จัดจำหน่าย',
      render: (_, row) => (
        <div>
          <p className="text-slate-800 dark:text-slate-100">{row.supplier?.supplier_name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-300">{row.supplier?.supplier_id}</p>
        </div>
      ),
    },
    {
      key: 'invoice_supplier_date',
      label: 'วันที่เอกสาร',
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: 'invoice_supplier_due_date',
      label: 'ครบกำหนด',
      sortable: true,
      render: (value) => formatDate(value as string),
    },
    {
      key: 'invoice_supplier_status',
      label: 'สถานะ',
      render: (value) => {
        const status = value as InvoiceSupplierRow['invoice_supplier_status'];
        return (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_BADGE[status]}`}>
            {INVOICE_STATUS_LABELS[status]}
          </span>
        );
      },
    },
    {
      key: 'invoice_supplier_total',
      label: 'ยอดเอกสาร',
      sortable: true,
      render: (value, row) => {
        const paid = (row.invoicePayments || []).reduce((sum, item) => sum + Number(item.invoice_payment_price || 0), 0);
        return (
          <div className="text-right">
            <p className="font-semibold text-slate-800 dark:text-slate-100">฿{formatCurrency(Number(value || 0))}</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">ชำระแล้ว ฿{formatCurrency(paid)}</p>
          </div>
        );
      },
    },
    {
      key: 'invoice_supplier_id',
      label: 'การจัดการ',
      width: '180px',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openDetailModal(row)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-700"
            title="ดูรายละเอียด"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>

          {canEditInvoice && (
            <button
              type="button"
              onClick={() => void openUpdateModal(row)}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
              title="แก้ไข"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l8.293-8.293-3-3L5 12z" />
              </svg>
            </button>
          )}

          {canDeleteInvoice && (
            <button
              type="button"
              onClick={() => {
                setSelectedInvoice(row);
                setIsDeleteOpen(true);
              }}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700"
              title="ลบ"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  const handleApprovedSort = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
    if (!sort) {
      setApprovedSortField(null);
      setApprovedSortOrder('DESC');
      return;
    }

    const nextField = sort.key as ApprovedSortField;
    if (nextField !== 'entry_date' && nextField !== 'purchase_receipt_total') {
      setApprovedSortField(null);
      setApprovedSortOrder('DESC');
      return;
    }

    setApprovedSortField(nextField);
    setApprovedSortOrder(sort.direction);
  };

  const handleInvoiceSort = (sort: { key: string; direction: 'ASC' | 'DESC' } | null) => {
    if (!sort) {
      setInvoiceSortField('invoice_supplier_date');
      setInvoiceSortOrder('DESC');
      return;
    }

    const nextField = sort.key as InvoiceSortField;
    if (
      nextField !== 'invoice_supplier_date' &&
      nextField !== 'invoice_supplier_due_date' &&
      nextField !== 'invoice_supplier_total'
    ) {
      setInvoiceSortField('invoice_supplier_date');
      setInvoiceSortOrder('DESC');
      return;
    }

    setInvoiceSortField(nextField);
    setInvoiceSortOrder(sort.direction);
  };

  return (
    <div className="bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8 dark:bg-gray-900">
      {loading && <LoadingSkeletonProps />}

      <div className="space-y-6">
        <section className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
          <div className="border-b border-gray-100 p-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">รายการใบรับสินค้าที่อนุมัติแล้ว</h2>
          </div>

          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-end">
            <input
              type="text"
              value={approvedSearchInput}
              onChange={(event) => setApprovedSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setApprovedPage(1);
                  setApprovedSearch(approvedSearchInput.trim());
                }
              }}
              placeholder="ค้นหาใบรับสินค้า..."
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:max-w-sm"
            />
            <button
              type="button"
              onClick={() => {
                setApprovedPage(1);
                setApprovedSearch(approvedSearchInput.trim());
              }}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              ค้นหา
            </button>
            <button
              type="button"
              onClick={() => {
                setApprovedSearchInput('');
                setApprovedSearch('');
                setApprovedPage(1);
              }}
              className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              ล้าง
            </button>
          </div>

          <div className="p-2">
            <DataTable
              data={approvedRows}
              columns={approvedColumns}
              keyField="purchase_receipt_id"
              className="bg-white dark:bg-gray-800"
              paginationMeta={approvedMeta}
              currentPage={approvedPage}
              onPageChange={setApprovedPage}
              onSortChange={handleApprovedSort}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
          <div className="border-b border-gray-100 p-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">รายการใบชำระหนี้ผู้จัดจำหน่าย</h2>
          </div>
          {invoiceLoading && <LoadingSkeletonProps />}
          <div className="p-2">
            <DataTable
              data={invoiceRows}
              columns={invoiceColumns}
              keyField="invoice_supplier_id"
              className="bg-white dark:bg-gray-800"
              paginationMeta={invoiceMeta}
              currentPage={invoicePage}
              onPageChange={setInvoicePage}
              onSortChange={handleInvoiceSort}
            />

            {invoiceRows.length === 0 && !invoiceLoading && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-600 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-300">
                ยังไม่มีรายการใบชำระหนี้
              </div>
            )}
          </div>
        </section>
      </div>

      <InsertInvoiceSupplierForm
        isOpen={isInsertOpen}
        onClose={() => {
          setIsInsertOpen(false);
          setSelectedApprovedReceipt(null);
          setAvailableSupplierPayments([]);
        }}
        onSubmit={(payload) => void handleInsertInvoice(payload)}
        sourceReceipt={selectedApprovedReceipt}
        availablePayments={availableSupplierPayments}
      />

      <UpdateInvoiceSupplierForm
        isOpen={isUpdateOpen}
        onClose={() => {
          setIsUpdateOpen(false);
          setSelectedInvoice(null);
        }}
        onSubmit={(payload) => void handleUpdateInvoice(payload)}
        invoice={selectedInvoice}
      />

      <InvoiceSupplierDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen && canDeleteInvoice}
        title="ยืนยันการลบใบชำระหนี้"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบใบชำระหนี้ "${selectedInvoice?.invoice_supplier_code || ''}"?`}
        onCancel={() => {
          setIsDeleteOpen(false);
          setSelectedInvoice(null);
        }}
        onConfirm={() => void handleDeleteInvoice()}
      />

      <ActionResultDialog
        isOpen={resultDialog.isOpen}
        status={resultDialog.status}
        action={resultDialog.action}
        message={resultDialog.message}
        onClose={() => setResultDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
