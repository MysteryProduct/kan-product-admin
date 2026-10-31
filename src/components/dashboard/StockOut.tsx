"use client";

import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import type { OpenList } from "@/components/dashboard/DashboardListModal";
import PurchaseDraftDialog from "@/components/dashboard/PurchaseDraftDialog";
import type { StockOut as StockOutData } from "@/types/dashboard";

const count = (value: number) => new Intl.NumberFormat("th-TH").format(value);

interface StockOutCardProps {
  id: string;
  target: OpenList;
  emptyText: string;
  total: number;
  names: string[];
  onOpen: (list: OpenList) => void;
  /** A shortcut under the card, shown while something is out. */
  action?: { onClick: () => void; label: string };
}

// The card shows a few names; past this many it links to the whole list (TASK-0321 D4).
const SHOWN = 3;

function StockOutCard({ id, target, emptyText, total, names, onOpen, action }: StockOutCardProps) {
  const shown = names.slice(0, SHOWN);
  return (
    <section className="ka-card ka-panel" aria-labelledby={id}>
      <div className="ka-panel__head">
        <h2 id={id} className="ka-card__title">{target.title}</h2>
        {total > 0 ? (
          <StatusBadge tone="danger">{count(total)} รายการ</StatusBadge>
        ) : (
          <StatusBadge tone="success">ไม่มี</StatusBadge>
        )}
      </div>
      {total === 0 ? (
        <p className="ka-panel__note">{emptyText}</p>
      ) : (
        <ul className="ka-outlist">
          {shown.map((name, index) => (
            <li key={`${name}-${index}`}>
              <span className="ka-outlist__name">{name}</span>
              <span className="ka-todo__cap">คงเหลือ 0</span>
            </li>
          ))}
        </ul>
      )}
      {total > SHOWN && (
        <button type="button" aria-haspopup="dialog" className="ka-panel__link ka-kpi__open" onClick={() => onOpen(target)}>
          ดูทั้งหมด {count(total)} รายการ →
        </button>
      )}
      {action && total > 0 && (
        <button type="button" aria-haspopup="dialog" className="ka-btn ka-panel__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </section>
  );
}

/**
 * Out of stock: a count and the first few names for each list the API sent; the
 * card opens the whole list. "Out" means the remaining stock is 0, including
 * never having been stocked.
 */
export default function StockOut({
  stock,
  onOpen,
  hideProducts = false,
  canOrder = false,
}: {
  stock: StockOutData;
  onOpen: (list: OpenList) => void;
  /** The stock overview already shows the out-of-stock variants, so the same card is left out. */
  hideProducts?: boolean;
  /** The employee may add purchase orders, so the materials card offers the shortcut. */
  canOrder?: boolean;
}) {
  const { materials } = stock;
  const [ordering, setOrdering] = useState(false);
  const products = hideProducts ? undefined : stock.products;
  if (!products && !materials) return null;

  return (
    <>
      {products && (
        <StockOutCard
          id="dashboard-stock-out-products"
          target={{ key: "stock_out_products", title: "สินค้าที่หมด", href: "/admin/products" }}
          emptyText="ไม่มีสินค้าที่หมด (แยกตามสีและขนาด)"
          total={products.count}
          names={products.items.map((item) => [item.product_name, item.color_name, item.size_name].filter(Boolean).join(" · "))}
          onOpen={onOpen}
        />
      )}
      {materials && (
        <StockOutCard
          id="dashboard-stock-out-materials"
          target={{ key: "stock_out_materials", title: "วัตถุดิบหมด", href: "/admin/materials" }}
          emptyText="ไม่มีวัตถุดิบที่หมด"
          total={materials.count}
          names={materials.items.map((item) => item.material_name)}
          onOpen={onOpen}
          action={canOrder ? { onClick: () => setOrdering(true), label: "สร้างใบสั่งซื้อ" } : undefined}
        />
      )}
      {materials && canOrder && ordering && (
        <PurchaseDraftDialog isOpen onClose={() => setOrdering(false)} materials={materials.items} />
      )}
    </>
  );
}
