'use client';
import type { PendingWork } from '@/types/dashboard';
import type { StoreOrderQueue } from '@/types/store-fulfillment';
import SfIcon, { type SfIconName } from './sf-icon';

const TILES: {
  queue: StoreOrderQueue;
  count: keyof PendingWork;
  label: string;
  icon: SfIconName;
  tone: string;
}[] = [
  { queue: 'to_ship', count: 'store_orders_to_ship', label: 'รอจัดส่ง', icon: 'truck', tone: 'brand' },
  { queue: 'to_pickup', count: 'store_orders_to_pickup', label: 'รอรับที่ร้าน', icon: 'store', tone: 'info' },
  { queue: 'to_review', count: 'store_orders_to_review', label: 'รอตรวจสอบ', icon: 'check', tone: 'warning' },
  { queue: 'cancellations_to_decide', count: 'store_cancellations_to_decide', label: 'คำขอยกเลิก', icon: 'xCircle', tone: 'danger' },
  { queue: 'refunds_unfinished', count: 'store_refunds_unfinished', label: 'เงินคืนที่ยังไม่เสร็จ', icon: 'undo', tone: 'neutral' },
];

/**
 * TASK-0350: the five counts behind the number beside this page in the menu. Each one filters
 * the list to its queue. A count the API left out (no permission, or not loaded) has no tile.
 */
export default function WorkTiles({
  work,
  selected,
  onSelect,
}: {
  work: PendingWork | undefined;
  selected: StoreOrderQueue | '';
  onSelect: (queue: StoreOrderQueue | '') => void;
}) {
  const shown = TILES.filter((tile) => work?.[tile.count] !== undefined);
  if (shown.length === 0) return null;
  return (
    <section className="ka-sf-tiles" aria-label="งานที่รออยู่">
      {shown.map((tile) => (
        <button
          key={tile.queue}
          type="button"
          className="ka-sf-tile"
          aria-pressed={selected === tile.queue}
          onClick={() => onSelect(selected === tile.queue ? '' : tile.queue)}
        >
          <span className="ka-sf-row ka-sf-row--between">
            <span className={`ka-sf-tile__icon ka-sf-tone--${tile.tone}`}>
              <SfIcon name={tile.icon} />
            </span>
            <span className="ka-sf-tile__num">{work?.[tile.count]}</span>
          </span>
          <span className="ka-sf-tile__label">{tile.label}</span>
        </button>
      ))}
    </section>
  );
}
