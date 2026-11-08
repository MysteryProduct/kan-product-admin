'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { usePermissions } from '@/hooks/usePermissions';
import { refreshStockPending, useStockPending } from '@/hooks/useStockPending';
import { getApiErrorMessage } from '@/lib/api-error';
import StockModel, { type StockKind, type StockOverview } from '@/models/stock';
import AdjustForm from './components/adjust-form';
import AdjustTab from './components/adjust-tab';
import CountNew from './components/count-new';
import CountTab from './components/count-tab';
import HistoryTab from './components/history-tab';
import ListTab from './components/list-tab';
import { Icon, type IconName } from './components/icons';
import LotsTab from './components/lots-tab';
import './stock.css';

const stockModel = new StockModel();
const KIND_NAMES: Record<StockKind, string> = { material: 'วัตถุดิบ', product: 'สินค้าสำเร็จรูป' };
const TABS = [
  { key: 'list', label: 'ยอดคงเหลือ' },
  { key: 'lots', label: 'เปิดล็อตขาย' },
  { key: 'adj', label: 'ปรับยอด' },
  { key: 'count', label: 'นับสต็อก' },
  { key: 'hist', label: 'ประวัติ' },
];
const formatCount = (value: number) => value.toLocaleString('th-TH');
const formatMoney = (value: number) =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TypeCard({ kind, on, onPick }: { kind: StockKind; on: boolean; onPick: () => void }) {
  const [overview, setOverview] = useState<StockOverview>();
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setOverview(await stockModel.getOverview(kind));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [kind]);

  useEffect(() => {
    // Loads from the API; state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) {
    return (
      // Still a tab so the kind stays reachable; picking it also retries the overview.
      <button
        type="button"
        role="tab"
        aria-selected={on}
        className={`tcard${on ? ' on' : ''}`}
        onClick={() => {
          onPick();
          void load();
        }}
      >
        <span className="tname">{KIND_NAMES[kind]}</span>
        <span className="cap" role="alert">โหลดภาพรวมไม่สำเร็จ: {error}</span>
        <span className="cap">กดเพื่อลองใหม่</span>
      </button>
    );
  }

  return (
    <button type="button" role="tab" aria-selected={on} className={`tcard${on ? ' on' : ''}`} onClick={onPick}>
      <span className="row between">
        <span className={`tic ${on ? 'br' : 'nt'}`}><Icon name={kind === 'material' ? 'box' : 'cube'} /></span>
        <span className="tval">
          <span className="tnum">{overview ? formatCount(overview.items) : '…'}</span>
          <span className="cap">รายการ</span>
        </span>
      </span>
      <span className="tname">{KIND_NAMES[kind]}</span>
      {overview && (
        <>
          <span className="hb" aria-hidden="true">
            <i className="h-ok" style={{ flexGrow: overview.normal }} />
            {overview.low > 0 && <i className="h-wn" style={{ flexGrow: overview.low }} />}
            {overview.out > 0 && <i className="h-dn" style={{ flexGrow: overview.out }} />}
          </span>
          <span className="hl">
            <span><b className="h-ok" />ปกติ {formatCount(overview.normal)}</span>
            <span><b className="h-wn" />เหลือน้อย {formatCount(overview.low)}</span>
            <span><b className="h-dn" />หมด {formatCount(overview.out)}</span>
          </span>
          <span className="cap num">
            {overview.stockValue === null ? 'ไม่มีต้นทุน' : `มูลค่าตามต้นทุน ฿${formatMoney(overview.stockValue)}`}
          </span>
        </>
      )}
    </button>
  );
}

function StockPageContent() {
  const { can } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pending = useStockPending();
  const toast = useToast();
  const [adjusting, setAdjusting] = useState<{ itemId?: string }>();
  const [adjustReload, setAdjustReload] = useState(0);
  const [startingCount, setStartingCount] = useState(false);

  const canMaterial = can('stock_material', 'view');
  const canProduct = can('stock_product', 'view');
  const canLots = can('store_fulfillment', 'view');
  // `add` alone counts: it reaches the count tab and nothing that reads figures (TASK-0364 Q11, Q12).
  const seeMaterial = canMaterial || can('stock_material', 'add');
  const seeProduct = canProduct || can('stock_product', 'add');
  const limited = !seeMaterial && !seeProduct; // G9: lots only

  const askedType = params.get('type');
  const type: StockKind =
    limited || (askedType === 'product' && (seeProduct || canLots)) || !seeMaterial ? 'product' : 'material';
  const canViewType = can(`stock_${type}`, 'view');
  // Lots come from `store_fulfillment` alone (Q1): without product rights the product kind holds only that tab.
  const seeType = type === 'material' ? seeMaterial : seeProduct;
  const tabs = TABS.filter((item) =>
    item.key === 'lots' ? type === 'product' && canLots : seeType && (canViewType || item.key === 'count'),
  );
  const askedTab = params.get('tab');
  const tab = tabs.find((item) => item.key === askedTab)?.key ?? tabs[0]?.key;

  const go = (nextType: StockKind, nextTab: string) => {
    router.replace(`${pathname}?type=${nextType}&tab=${nextTab}`, { scroll: false });
  };

  const canCount = seeType && can(`stock_${type}`, 'add');
  const canAdjust = canCount && canViewType;
  const adjustItem = params.get('adjust');

  // The detail page links here with the item; the param goes so a refresh does not reopen the form.
  useEffect(() => {
    if (!adjustItem) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is the external source here
    if (canAdjust) setAdjusting({ itemId: adjustItem });
    router.replace(`${pathname}?type=${type}&tab=adj`, { scroll: false });
  }, [adjustItem, canAdjust, pathname, router, type]);

  // A work row opens the kind that holds the work, staying on the current kind when both or neither do (M4).
  const pendingKind = (field: 'adjustments' | 'counts'): StockKind => {
    const other = type === 'material' ? 'product' : 'material';
    const canOther = other === 'material' ? seeMaterial : seeProduct;
    // On the product kind reached through lots alone there is no adjust or count tab to land on.
    if (!seeType && canOther) return other;
    return canOther && pending && !pending.byKind[type][field] && pending.byKind[other][field] ? other : type;
  };
  // Both kinds reachable but the overview cards do not offer the switch (add-only rights, or lots without product view
  // where no work row covers it); material view + lots reaches lots through its work row.
  const reachProduct = seeProduct || canLots;
  const showSeg =
    seeMaterial && reachProduct && !(canMaterial && (canProduct || (canLots && !seeProduct)));
  const tabCount = (key: string) => {
    if (key === 'lots') return pending?.lots;
    if (key === 'adj') return pending?.byKind[type].adjustments;
    return key === 'count' ? pending?.byKind[type].counts : undefined;
  };
  const work = [
    { label: 'ล็อตรอเปิดขาย', sub: 'ยังขายไม่ได้จนกว่าจะเปิด', n: pending?.lots, show: canLots, tone: 'inf', icon: 'store', to: ['product', 'lots'] as const },
    { label: 'ปรับยอดรออนุมัติ', sub: 'ยอดจริงยังไม่เปลี่ยน', n: pending?.adjustments, show: true, tone: 'wn', icon: 'adj', to: [pendingKind('adjustments'), 'adj'] as const },
    { label: 'รอบนับที่ยังไม่ปิด', sub: 'กำลังนับหรือรอตรวจผล', n: pending?.counts, show: true, tone: 'br', icon: 'clip', to: [pendingKind('counts'), 'count'] as const },
  ].filter((item) => item.show);

  return (
    <div className="ka-stock">
      <div className="ph">
        <div>
          <h1>สต็อก</h1>
          <p className="cap lead">ยอดวัตถุดิบและสินค้าสำเร็จรูปทุกล็อต งานนับ ปรับยอด และเปิดล็อตขายในที่เดียว</p>
        </div>
        {(canCount || canAdjust) && (
          <div className="hact">
            {canCount && (
              <button type="button" className="ka-btn" onClick={() => setStartingCount(true)}><Icon name="clip" />เริ่มรอบนับ</button>
            )}
            {canAdjust && (
              <button type="button" className="ka-btn ka-btn--primary" onClick={() => setAdjusting({})}><Icon name="adj" />ปรับยอดสต็อก</button>
            )}
          </div>
        )}
      </div>

      {(canMaterial || canProduct) && (
        <section className="ovw" aria-label="ภาพรวมสต็อก">
          <div className="types" role="tablist" aria-label="ชนิดสต็อก">
            {canMaterial && <TypeCard kind="material" on={type === 'material'} onPick={() => go('material', tab === 'lots' ? 'list' : tab)} />}
            {canProduct && <TypeCard kind="product" on={type === 'product'} onPick={() => go('product', tab)} />}
          </div>
          <aside className="card work" aria-label="งานรอทำ">
            <h2 className="wt">งานรอทำ</h2>
            {work.map((item) => (
              <button type="button" className="wk" key={item.label} onClick={() => go(item.to[0], item.to[1])}>
                <span className={`tic ${item.tone}`}><Icon name={item.icon as IconName} /></span>
                <span className="wkt"><b>{item.label}</b><span className="cap">{item.sub}</span></span>
                <span className="wkn">{item.n === undefined ? '–' : formatCount(item.n)}</span>
                <Icon name="right" className="s go" />
              </button>
            ))}
          </aside>
        </section>
      )}

      {showSeg && (
        <div className="seg" role="group" aria-label="ชนิดสต็อก">
          {(['material', 'product'] as const).map((kind) => (
            <button type="button" key={kind} className={type === kind ? 'on' : ''} aria-pressed={type === kind} onClick={() => go(kind, tab === 'lots' ? 'count' : tab)}>
              {KIND_NAMES[kind]}
            </button>
          ))}
        </div>
      )}

      <section className="card stock-body">
        <div className="tabs" role="tablist" aria-label={`มุมมองของ${KIND_NAMES[type]}`}>
          {tabs.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.key}
              aria-selected={item.key === tab}
              className={`tab${item.key === tab ? ' on' : ''}`}
              onClick={() => go(type, item.key)}
            >
              {item.label}
              {!!tabCount(item.key) && <span className="tc">{formatCount(tabCount(item.key) ?? 0)}</span>}
            </button>
          ))}
        </div>
        {tab === 'lots' ? (
          <LotsTab />
        ) : tab === 'list' ? (
          <ListTab kind={type} canReorder={can(type === 'material' ? 'purchase_orders' : 'job_orders', 'add')} />
        ) : tab === 'adj' ? (
          <AdjustTab key={type} kind={type} canEdit={can(`stock_${type}`, 'edit')} reloadKey={adjustReload} />
        ) : tab === 'hist' ? (
          <HistoryTab
            key={type}
            kind={type}
            itemId={params.get('item') ?? undefined}
            onClearItem={() => go(type, 'hist')}
          />
        ) : tab === 'count' ? (
          <CountTab
            key={type}
            kind={type}
            canView={canViewType}
            canAdd={can(`stock_${type}`, 'add')}
            canEdit={can(`stock_${type}`, 'edit')}
          />
        ) : null}
      </section>

      {startingCount && (
        <CountNew
          kind={type}
          canView={canViewType}
          onClose={() => setStartingCount(false)}
          onOpened={(id) => {
            refreshStockPending();
            router.push(`/admin/stock/${type}/count/${id}`);
          }}
        />
      )}

      {adjusting && (
        <AdjustForm
          kind={type}
          itemId={adjusting.itemId}
          onClose={() => setAdjusting(undefined)}
          onSent={(code) => {
            setAdjusting(undefined);
            toast({ message: `ส่งคำขอ ${code} แล้ว รออนุมัติ` });
            refreshStockPending();
            setAdjustReload((value) => value + 1);
            go(type, 'adj');
          }}
        />
      )}
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={null}>
      <StockPageContent />
    </Suspense>
  );
}
