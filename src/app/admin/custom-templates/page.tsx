'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, DataTableColumn } from '@/components/DataTable';
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
    { key: 'template_code', label: 'รหัสแบบ', width: '160px', render: (value) => <span className="ka-code">{String(value ?? '')}</span> },
    { key: 'template_name', label: 'ชื่อแบบสินค้า', alwaysVisible: true },
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
          aria-label={`${canEdit ? 'เปิดและแก้ไข' : 'ดูรายละเอียด'} ${row.template_code}`}
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
    <div className="ka-page-body">
      <LoadErrorBanner message={loadError} onRetry={() => load()} className="mb-4" />

      <div className="ka-ph">
        <div>
          <h1 className="ka-ph__title">แบบสินค้า Custom</h1>
          <p className="ka-ph__lead">ตั้งค่าตัวเลือก กฎความเข้ากัน สูตรวัสดุ และราคา · ลูกค้าเห็นเฉพาะฉบับที่เผยแพร่แล้ว</p>
        </div>
        {canAdd && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ka-btn" onClick={() => setTypeOpen(true)}>
              เพิ่มประเภทงาน
            </button>
            <button type="button" className="ka-btn ka-btn--primary" onClick={() => setTemplateOpen(true)}>
              เพิ่มแบบสินค้า
            </button>
          </div>
        )}
      </div>

      <section className="ka-card ka-table-card mb-6" aria-labelledby="ct-templates">
        <div className="ka-card__head">
          <h2 id="ct-templates" className="ka-card__title">แบบสินค้า</h2>
          <span className="ka-todo__cap numeric">{templates.length} แบบ</span>
        </div>
        <DataTable data={templates} columns={templateColumns} keyField="custom_template_id" cardTitleKey="template_name" loading={loading && templates.length === 0} className="ka-table-flat" emptyHint="ยังไม่มีแบบสินค้า Custom" />
      </section>

      <section className="ka-card ka-table-card" aria-labelledby="ct-types">
        <div className="ka-card__head">
          <div>
            <h2 id="ct-types" className="ka-card__title">ประเภทงาน</h2>
            <p className="ka-todo__cap">แก้ว เสื้อ สติกเกอร์ และหน่วยที่ใช้ขาย</p>
          </div>
        </div>
        <DataTable data={types} columns={typeColumns} keyField="custom_product_type_id" cardTitleKey="type_name" loading={loading && types.length === 0} className="ka-table-flat" emptyHint="ยังไม่มีประเภทงาน" />
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
