'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import Modal from '@/components/Modal';
import { usePermissions } from '@/hooks/usePermissions';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatThaiDate, formatThaiDateTime } from '@/lib/date-format';
import StockModel, {
  MOVEMENT_LABELS,
  type StockDocument,
  type StockItemDetail,
  type StockKind,
  type StockMovement,
} from '@/models/stock';
import { reorderHref } from '../../components/list-tab';
import '../../stock.css';
import { Icon } from '../../components/icons';
import { LoadFailed, LoadingRows, NoAccess } from '../../components/states';

const stockModel = new StockModel();
const fmt = (value: number) => value.toLocaleString('th-TH');
const money = (value: number) => value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS = {
  normal: { label: 'ปกติ', badge: 'ok', meter: '' },
  low: { label: 'เหลือน้อย', badge: 'wn', meter: 'm-wn' },
  out: { label: 'หมด', badge: 'dnb', meter: 'm-dn' },
} as const;
const DOCUMENT_ROUTES: Record<string, { menu: string; href: (id: string) => string }> = {
  purchase_order: { menu: 'purchase_orders', href: (id) => `/admin/purchase-orders/${id}` },
  sale_order: { menu: 'sale_orders', href: (id) => `/admin/sale-orders/${id}` },
  job_order: { menu: 'job_orders', href: () => '/admin/job-orders' },
};

function DocumentRow({ doc }: { doc: StockDocument }) {
  const { can } = usePermissions();
  const route = DOCUMENT_ROUTES[doc.documentType];
  return (
    <div className="al">
      {route && can(route.menu, 'view') ? (
        <Link className="code doc" href={route.href(doc.documentId)}>{doc.documentCode}</Link>
      ) : (
        <span className="code">{doc.documentCode}</span>
      )}
      <span className="num strong">{fmt(doc.qty)}</span>
    </div>
  );
}

function ThresholdModal({
  item,
  kind,
  defaultThreshold,
  onClose,
  onSaved,
}: {
  item: StockItemDetail;
  kind: StockKind;
  defaultThreshold: number | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [own, setOwn] = useState(item.thresholdSource === 'custom');
  const [value, setValue] = useState(String(item.threshold));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const valid = !own || /^\d+$/.test(value.trim());

  const save = async () => {
    if (!valid) {
      setError('กรอกจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await stockModel.setThreshold(kind, item.id, own ? Number(value) : null);
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      className="ka-stock-modal"
      isOpen
      onClose={onClose}
      title="ตั้งจุดเตือน"
      description={item.name}
      size="standard"
      footer={
        <>
          <button type="button" className="ka-btn" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="button" className="ka-btn ka-btn--primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึกจุดเตือน'}
          </button>
        </>
      }
    >
      <div className="ka-stock-form">
        <div className="opts">
          <button type="button" className={`opt${own ? '' : ' on'}`} aria-pressed={!own} onClick={() => setOwn(false)}>
            <span className="rd" />
            <span>
              <b>ใช้ค่ากลาง</b>
              <span className="cap num">
                {defaultThreshold === undefined ? 'ตั้งที่ตั้งค่าพื้นฐาน' : `ตอนนี้ ${fmt(defaultThreshold)} ${item.unitName ?? ''} ตั้งที่ตั้งค่าพื้นฐาน`}
              </span>
            </span>
          </button>
          <button type="button" className={`opt${own ? ' on' : ''}`} aria-pressed={own} onClick={() => setOwn(true)}>
            <span className="rd" />
            <span><b>กำหนดเฉพาะรายการนี้</b><span className="cap">เหมาะกับของที่ใช้เร็วหรือสั่งนาน</span></span>
          </button>
        </div>
        {own && (
          <>
            <label className="thr-row">
              <span className="lbl">เตือนเมื่อคงเหลือไม่เกิน ({item.unitName})</span>
              <input
                className="in"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-label="จุดเตือน"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <p className="cap">ตั้ง 0 เพื่อปิดการเตือนเหลือน้อย</p>
          </>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

export default function StockItemPage() {
  const params = useParams<{ kind: string; id: string }>();
  const { can, isLoaded } = usePermissions();
  const kind = params.kind as StockKind;
  const id = params.id;
  if (kind !== 'material' && kind !== 'product') notFound();

  const [item, setItem] = useState<StockItemDetail>();
  const [moves, setMoves] = useState<StockMovement[]>();
  const [defaultThreshold, setDefaultThreshold] = useState<number>();
  const [error, setError] = useState('');
  const [moveError, setMoveError] = useState('');
  const [editing, setEditing] = useState(false);

  const isProduct = kind === 'product';
  const menu = isProduct ? 'stock_product' : 'stock_material';
  const availLabel = isProduct ? 'พร้อมขาย' : 'พร้อมใช้';
  const incomingLabel = isProduct ? 'กำลังผลิต' : 'ค้างรับจากใบสั่งซื้อ';
  const reorderLabel = isProduct ? 'สร้างงานผลิต' : 'สร้างใบสั่งซื้อ';

  const load = useCallback(async () => {
    setError('');
    setMoveError('');
    try {
      setItem(await stockModel.getItem(kind, id));
    } catch (err) {
      setError(getApiErrorMessage(err));
      return;
    }
    stockModel.getOverview(kind).then((res) => setDefaultThreshold(res.defaultThreshold)).catch(() => setDefaultThreshold(undefined));
    try {
      setMoves((await stockModel.listMovements(kind, { item_id: id, page: 1, limit: 4 })).data);
    } catch (err) {
      setMoveError(getApiErrorMessage(err));
    }
  }, [kind, id]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const back = <Link className="back" href={`/admin/stock?type=${kind}&tab=list`}>กลับไปหน้าสต็อก</Link>;

  if (isLoaded && !can(`stock_${kind}`, 'view')) {
    return (
      <div className="ka-stock">
        {back}
        <NoAccess />
      </div>
    );
  }
  if (error) {
    return (
      <div className="ka-stock">
        {back}
        <LoadFailed title="โหลดรายการไม่สำเร็จ" detail={error} onRetry={() => void load()} />
      </div>
    );
  }
  if (!item) {
    return <div className="ka-stock">{back}<div className="card"><LoadingRows /></div></div>;
  }

  const view = STATUS[item.status];
  const cap = Math.max(item.remainQty, item.threshold * 2.5, 1);
  const pct = (value: number) => `${Math.round((value / cap) * 1000) / 10}%`;
  const hold = item.pendingReleaseQty ?? 0;

  return (
    <div className="ka-stock">
      {back}
      <section className="card hero2">
        <div
          className={`bigt ${view.meter}`}
          role="img"
          aria-label={`คงเหลือ ${fmt(item.remainQty)} ${item.unitName ?? ''} จองแล้ว ${fmt(item.reservedQty)} ${availLabel} ${fmt(item.availableQty)} จุดเตือน ${fmt(item.threshold)}`}
        >
          <div className="bf">
            <i className="sa" style={{ height: pct(item.availableQty) }} />
            <i className="sh" style={{ height: pct(hold) }} />
            <i className="sr" style={{ height: pct(item.reservedQty) }} />
          </div>
          <span className="bt" style={{ bottom: pct(item.threshold) }} />
        </div>
        <div className="row wrap between top">
          <div className="tt0">
            <h1>{item.name}</h1>
            <div className="row wrap meta">
              <span className="code">{item.code}</span>
              <span className={`bd ${view.badge}`}>{view.label}</span>
              <span className="cap">{isProduct ? 'สินค้าสำเร็จรูป' : 'วัตถุดิบ'} · หน่วย{item.unitName}</span>
            </div>
          </div>
          <div className="row wrap hact">
            {can(isProduct ? 'job_orders' : 'purchase_orders', 'add') && (
              <Link className="ka-btn" href={reorderHref(kind, item.id)}>{reorderLabel}</Link>
            )}
            {can(menu, 'add') && (
              <Link className="ka-btn ka-btn--primary" href={`/admin/stock?type=${kind}&tab=adj&adjust=${item.id}`}><Icon name="adj" />ปรับยอด</Link>
            )}
          </div>
        </div>
        <dl className="stats">
          <div className="stat"><dt>คงเหลือ</dt><dd>{fmt(item.remainQty)}</dd></div>
          <div className="stat"><dt>จองแล้ว</dt><dd>{fmt(item.reservedQty)}</dd></div>
          <div className="stat"><dt>{availLabel}</dt><dd>{fmt(item.availableQty)}</dd></div>
          <div className="stat"><dt>{incomingLabel}</dt><dd>{fmt(item.incomingQty)}</dd></div>
          <div className="stat">
            <dt>จุดเตือน</dt>
            <dd>{fmt(item.threshold)}</dd>
            {can(menu, 'edit') ? (
              <button type="button" className="link cap" onClick={() => setEditing(true)}>
                {item.thresholdSource === 'custom' ? 'ตั้งเอง' : 'ค่ากลาง'} · แก้ไข
              </button>
            ) : (
              <span className="cap">{item.thresholdSource === 'custom' ? 'ตั้งเอง' : 'ค่ากลาง'}</span>
            )}
          </div>
        </dl>
      </section>

      <div className="d-grid">
        <div className="stack">
          <section className="card clip">
            <div className="chd">
              <div>
                <h2>ล็อตในคลัง</h2>
                <p className="cap">{isProduct ? 'ขายได้เฉพาะล็อตที่เปิดขายแล้ว' : 'ตัดล็อตเก่าก่อนตามลำดับรับเข้า'}</p>
              </div>
              <span className="bd nt">{fmt(item.lots.length)} ล็อต</span>
            </div>
            {item.lots.length === 0 ? (
              <p className="empty cap">ยังไม่มีล็อตในคลัง</p>
            ) : (
              <div className="tw">
                <table className="it">
                  <thead>
                    <tr>
                      <th>ที่มา</th>
                      <th>รับเข้าเมื่อ</th>
                      <th className="r">{isProduct ? 'ยอดของล็อต' : 'รับมา'}</th>
                      <th className="r">คงเหลือ</th>
                      <th className="r">จองแล้ว</th>
                      <th className="r">ต้นทุน/หน่วย</th>
                      {isProduct && <th>สถานะ</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {item.lots.map((lot) => (
                      <tr key={lot.lotId}>
                        <td><span className="code doc">{lot.sourceLabel}</span></td>
                        <td>{formatThaiDate(lot.receivedAt)}</td>
                        <td className="r num">{fmt(lot.receivedQty)}</td>
                        <td className="r num strong">{fmt(lot.remainQty)}</td>
                        <td className="r num">{fmt(lot.reservedQty)}</td>
                        <td className="r num">{lot.unitCost > 0 ? `฿${money(lot.unitCost)}` : 'ไม่มีต้นทุน'}</td>
                        {isProduct && (
                          <td><span className={`bd ${lot.released ? 'ok' : 'wn'}`}>{lot.released ? 'เปิดขายแล้ว' : 'รอเปิดขาย'}</span></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card cp">
            <div className="row between mb">
              <h2>ความเคลื่อนไหวล่าสุด</h2>
              <Link className="link" href={`/admin/stock?type=${kind}&tab=hist&item=${item.id}`}>ดูทั้งหมด</Link>
            </div>
            {moveError ? (
              <div role="alert">
                <p className="cap">โหลดความเคลื่อนไหวไม่สำเร็จ: {moveError}</p>
                <button type="button" className="ka-btn" onClick={() => void load()}>ลองใหม่</button>
              </div>
            ) : !moves ? (
              <p className="cap" role="status">กำลังโหลด…</p>
            ) : moves.length === 0 ? (
              <p className="cap">ยังไม่มีความเคลื่อนไหว</p>
            ) : (
              <div className="tl">
                {moves.map((move) => (
                  <div key={move.stockMovementId}>
                    <span className={`d ${move.remainDelta > 0 ? 'g' : move.remainDelta < 0 ? 'w' : ''}`} />
                    <div className="grow">
                      <div className="row between wrap tlh">
                        <span>{MOVEMENT_LABELS[move.movementType] ?? 'ความเคลื่อนไหว'} {move.documentCode && <span className="code doc">{move.documentCode}</span>}</span>
                        <span className="qty">{(move.remainDelta || move.reserveDelta) > 0 ? '+' : ''}{fmt(move.remainDelta || move.reserveDelta)}</span>
                      </div>
                      <div className="cap">{formatThaiDateTime(move.createdAt)} · {move.actorName ?? 'ระบบ'} · คงเหลือ {fmt(move.itemRemainAfter)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="aside">
          <section className="card cp">
            <h3>กำลังถูกจอง</h3>
            {item.reservations.length === 0 ? (
              <p className="cap">ไม่มีเอกสารจองอยู่</p>
            ) : (
              <div className="alist">{item.reservations.map((doc) => <DocumentRow key={doc.documentId} doc={doc} />)}</div>
            )}
          </section>
          <section className="card cp">
            <h3>{incomingLabel}</h3>
            {item.incoming.length === 0 ? (
              <p className="cap">ไม่มีเอกสารค้างอยู่ {reorderLabel}ได้จากปุ่มด้านบน</p>
            ) : (
              <div className="alist">{item.incoming.map((doc) => <DocumentRow key={doc.documentId} doc={doc} />)}</div>
            )}
          </section>
        </div>
      </div>

      {editing && (
        <ThresholdModal
          item={item}
          kind={kind}
          defaultThreshold={defaultThreshold}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); void load(); }}
        />
      )}
    </div>
  );
}
