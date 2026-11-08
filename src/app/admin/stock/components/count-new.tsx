'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { getApiErrorMessage } from '@/lib/api-error';
import StockModel, {
  type CountScope,
  type StockItem,
  type StockKind,
  type StockOverview,
} from '@/models/stock';
import { Icon } from './icons';

const stockModel = new StockModel();
const KIND_NAMES: Record<StockKind, string> = { material: 'วัตถุดิบ', product: 'สินค้าสำเร็จรูป' };
const formatCount = (value: number) => value.toLocaleString('th-TH');
const itemLabel = (item: StockItem) =>
  [item.name, item.colorName, item.sizeName].filter(Boolean).join(' · ');

export default function CountNew({
  kind,
  canView,
  onClose,
  onOpened,
}: {
  kind: StockKind;
  canView: boolean;
  onClose: () => void;
  onOpened: (id: string) => void;
}) {
  const [overview, setOverview] = useState<StockOverview>();
  const [scope, setScope] = useState<CountScope>('all');
  const [hide, setHide] = useState(true);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<StockItem[]>();
  const [itemsError, setItemsError] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canView) return;
    // Only the hint under each scope needs it; the round opens without it.
    stockModel.getOverview(kind).then(setOverview).catch(() => setOverview(undefined));
  }, [kind, canView]);

  useEffect(() => {
    if (scope !== 'selected') return;
    let stale = false;
    const timer = window.setTimeout(() => {
      setItemsError('');
      stockModel
        .listItems(kind, { q: query.trim() || undefined, page: 1, limit: 50 })
        .then((result) => {
          if (!stale) setItems(result.data);
        })
        .catch((err) => {
          if (stale) return;
          setItems(undefined);
          setItemsError(getApiErrorMessage(err));
        });
    }, 300);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [kind, scope, query]);

  const scopes: { key: CountScope; label: string; sub: string }[] = [
    { key: 'all', label: 'ทั้งหมด', sub: overview ? `${formatCount(overview.items)} รายการ` : '' },
    {
      key: 'low',
      label: 'เฉพาะเหลือน้อยและหมด',
      sub: overview ? `${formatCount(overview.low + overview.out)} รายการ` : '',
    },
    // Choosing reads the item list, which `add` alone cannot.
    ...(canView
      ? [{ key: 'selected' as const, label: 'เลือกรายการเอง', sub: 'ค้นชื่อหรือรหัสแล้วติ๊กรายการ' }]
      : []),
  ];

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  };

  async function start() {
    setPending(true);
    setError('');
    try {
      const { id } = await stockModel.openRound(kind, {
        scope,
        hideSystemQty: hide,
        ...(scope === 'selected' ? { itemIds: [...picked] } : {}),
      });
      onOpened(id);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setPending(false);
    }
  }

  return (
    <Modal
      className="ka-stock-modal"
      isOpen
      onClose={pending ? () => undefined : onClose}
      title="เริ่มรอบนับ"
      description={KIND_NAMES[kind]}
      size="standard"
      footer={
        <>
          <button type="button" className="ka-btn min-h-11" disabled={pending} onClick={onClose}>ยกเลิก</button>
          <button
            type="button"
            className="ka-btn ka-btn--primary min-h-11"
            disabled={pending || (scope === 'selected' && picked.size === 0)}
            onClick={() => void start()}
          >
            {pending ? 'กำลังเริ่ม...' : 'เริ่มนับ'}
          </button>
        </>
      }
    >
      <div className="ka-stock-form">
        <div className="afield">
          <span className="lbl">ขอบเขต</span>
          <div className="opts">
            {scopes.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`opt${scope === item.key ? ' on' : ''}`}
                aria-pressed={scope === item.key}
                disabled={pending}
                onClick={() => setScope(item.key)}
              >
                <span className="rd" />
                <span>
                  <b>{item.label}</b>
                  {item.sub && <span className="cap">{item.sub}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>

        {scope === 'selected' && (
          <div className="afield">
            <label className="lbl" htmlFor="count-item-search">ค้นหารายการ</label>
            <input
              id="count-item-search"
              className="in wide"
              type="search"
              maxLength={100}
              value={query}
              placeholder="ชื่อหรือรหัส"
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="cap" role="status">เลือกแล้ว {formatCount(picked.size)} รายการ</span>
            {itemsError ? (
              <p role="alert" className="field-error">โหลดรายการไม่สำเร็จ: {itemsError}</p>
            ) : !items ? (
              <span className="cap">กำลังโหลด...</span>
            ) : items.length === 0 ? (
              <span className="cap">ไม่พบรายการ</span>
            ) : (
              <div className="pick">
                {items.map((item) => (
                  <label className="chk" key={item.id}>
                    <input type="checkbox" checked={picked.has(item.id)} disabled={pending} onChange={() => toggle(item.id)} />
                    <span>{itemLabel(item)} <span className="cap code">{item.code}</span></span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="chk">
          <input type="checkbox" checked={hide} disabled={pending} onChange={(event) => setHide(event.target.checked)} />
          <span>
            ซ่อนยอดในระบบระหว่างนับ
            <span className="cap blk">ผู้นับกรอกจากของจริง ช่วยให้ผลตรงไปตรงมา</span>
          </span>
        </label>
        <div className="ban inf">
          <Icon name="info" />
          <span>ระหว่างนับ ใบรับ งานผลิต และใบขายยังทำงานได้ ระบบแยกความเคลื่อนไหวระหว่างนับออกให้ตอนตรวจผล</span>
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
    </Modal>
  );
}
