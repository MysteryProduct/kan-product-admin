'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import StatusBadge from '@/components/StatusBadge';
import ActionResultDialog from '@/components/ActionResultDialog';
import { usePermissions } from '@/hooks/usePermissions';
import CustomCatalogModel from '@/models/custom-catalog';
import type { CustomProductType, CustomTemplateSummary } from '@/types/custom-catalog';
import { TemplateModal, TypeModal } from './components/CatalogModals';

const model = new CustomCatalogModel();

export default function CustomTemplatesPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const canAdd = can('products', 'add');
  const canEdit = can('products', 'edit');

  const [templates, setTemplates] = useState<CustomTemplateSummary[]>([]);
  const [types, setTypes] = useState<CustomProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [result, setResult] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

  const [reload, setReload] = useState(0);
  const load = useCallback(() => {
    setLoading(true);
    setReload((n) => n + 1);
  }, []);

  useEffect(() => {
    let current = true;
    void (async () => {
      const [t, ty] = await Promise.allSettled([model.getTemplates(), model.getTypes()]);
      if (!current) return;
      if (t.status === 'fulfilled') setTemplates(t.value);
      if (ty.status === 'fulfilled') setTypes(ty.value);
      const failed = [t, ty].find((r) => r.status === 'rejected');
      setLoadError(failed ? loadErrorText('แบบสินค้า Custom', (failed as PromiseRejectedResult).reason) : null);
      setLoading(false);
    })();
    return () => {
      current = false;
    };
  }, [reload]);

  const toggleType = async (type: CustomProductType) => {
    try {
      await model.updateType(type.custom_product_type_id, { is_active: !type.is_active });
      load();
    } catch (error) {
      setResult({ isOpen: true, message: error instanceof Error ? error.message : 'แก้ไขประเภทงานไม่สำเร็จ' });
    }
  };

  const templateColumns: DataTableColumn<CustomTemplateSummary>[] = [
    { key: 'template_code', label: 'รหัสแบบ', width: '160px' },
    { key: 'template_name', label: 'ชื่อแบบสินค้า' },
    {
      key: 'type_name',
      label: 'ประเภทงาน',
      render: (_, row) => `${row.type_name} (${row.sale_unit})`,
    },
    {
      key: 'published_revision',
      label: 'สถานะ',
      render: (_, row) => (
        <div className="flex flex-wrap gap-2">
          {row.published_revision !== null ? (
            <StatusBadge tone="success">เผยแพร่ ฉบับที่ {row.published_revision}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">ยังไม่เผยแพร่</StatusBadge>
          )}
          {row.draft_revision !== null && <StatusBadge tone="warning">ฉบับร่าง {row.draft_revision}</StatusBadge>}
        </div>
      ),
    },
    {
      key: 'custom_template_id',
      label: 'การจัดการ',
      width: '140px',
      render: (_, row) => (
        <button
          type="button"
          className="ka-btn ka-btn--sm"
          onClick={() => router.push(`/admin/custom-templates/${row.custom_template_id}`)}
        >
          {canEdit ? 'เปิดและแก้ไข' : 'ดูรายละเอียด'}
        </button>
      ),
    },
  ];

  const typeColumns: DataTableColumn<CustomProductType>[] = [
    { key: 'type_code', label: 'รหัส', width: '160px' },
    { key: 'type_name', label: 'ชื่อประเภทงาน' },
    { key: 'sale_unit', label: 'หน่วยที่ขาย', width: '140px' },
    {
      key: 'is_active',
      label: 'สถานะ',
      width: '200px',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'เปิดใช้' : 'ปิดใช้'}</StatusBadge>
          {canEdit && (
            <button type="button" className="ka-btn ka-btn--ghost ka-btn--sm" onClick={() => void toggleType(row)}>
              {row.is_active ? 'ปิดใช้' : 'เปิดใช้'}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 bg-[var(--bg-page)] p-2 sm:p-4 md:p-6 lg:p-8">
      {loading && <LoadingSkeleton />}
      <LoadErrorBanner message={loadError} onRetry={() => load()} />

      <section className="rounded-2xl bg-[var(--bg-surface)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink)]">แบบสินค้า Custom</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              ตั้งค่าตัวเลือก กฎความเข้ากันได้ สูตรวัสดุ และราคา — ลูกค้าเห็นเฉพาะฉบับที่เผยแพร่แล้ว
            </p>
          </div>
          {canAdd && (
            <button type="button" className="ka-btn ka-btn--primary" onClick={() => setTemplateOpen(true)}>
              เพิ่มแบบสินค้า
            </button>
          )}
        </div>
        <div className="p-2">
          <DataTable data={templates} columns={templateColumns} keyField="custom_template_id" className="bg-[var(--bg-surface)]" />
        </div>
      </section>

      <section className="rounded-2xl bg-[var(--bg-surface)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink)]">ประเภทงาน</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">แก้ว เสื้อ สติกเกอร์ และหน่วยที่ใช้ขาย</p>
          </div>
          {canAdd && (
            <button type="button" className="ka-btn" onClick={() => setTypeOpen(true)}>
              เพิ่มประเภทงาน
            </button>
          )}
        </div>
        <div className="p-2">
          <DataTable data={types} columns={typeColumns} keyField="custom_product_type_id" className="bg-[var(--bg-surface)]" />
        </div>
      </section>

      {canAdd && (
        <>
          <TypeModal isOpen={typeOpen} onClose={() => setTypeOpen(false)} onSaved={() => load()} />
          <TemplateModal
            isOpen={templateOpen}
            types={types}
            onClose={() => setTemplateOpen(false)}
            onCreated={(id) => router.push(`/admin/custom-templates/${id}`)}
          />
        </>
      )}

      <ActionResultDialog
        isOpen={result.isOpen}
        status="error"
        action="update"
        message={result.message}
        onClose={() => setResult({ isOpen: false, message: '' })}
      />
    </div>
  );
}
