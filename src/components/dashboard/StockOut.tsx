import Link from 'next/link';
import type { StockOut as StockOutData } from '@/types/dashboard';

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);

interface StockOutCardProps {
  href: string;
  title: string;
  emptyText: string;
  total: number;
  names: string[];
}

function StockOutCard({ href, title, emptyText, total, names }: StockOutCardProps) {
  const hidden = total - names.length;
  return (
    <Link href={href} className="ka-card ka-card--link ka-stat block">
      <span className="ka-stat__label">{title}</span>
      <p className="ka-stat__value">
        {count(total)}
        <span className="ml-2 text-[14px] font-normal text-[var(--ink-muted)]">รายการ</span>
      </p>
      {total === 0 ? (
        <p className="ka-stat__foot">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-1 text-[14px] text-[var(--ink)]">
          {names.map((name, index) => (
            <li key={`${name}-${index}`} className="break-words">
              {name}
            </li>
          ))}
          {hidden > 0 && <li className="text-[13px] text-[var(--ink-muted)]">และอีก {count(hidden)} รายการ</li>}
        </ul>
      )}
    </Link>
  );
}

/**
 * Out of stock: a count and the first few names for each list the API sent.
 * "Out" means the remaining stock is 0, including never having been stocked.
 */
export default function StockOut({ stock }: { stock: StockOutData }) {
  const { products, materials } = stock;
  if (!products && !materials) return null;

  return (
    <section aria-labelledby="dashboard-stock-out" className="mb-6">
      <h2 id="dashboard-stock-out" className="mb-3 text-[19px] font-semibold text-[var(--ink)]">
        สินค้าและวัตถุดิบที่หมด
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {products && (
          <StockOutCard
            href="/admin/products"
            title="สินค้าที่หมด (แยกตามสีและขนาด)"
            emptyText="ไม่มีสินค้าที่หมด"
            total={products.count}
            names={products.items.map((item) =>
              [item.product_name, item.color_name, item.size_name].filter(Boolean).join(' · '),
            )}
          />
        )}
        {materials && (
          <StockOutCard
            href="/admin/materials"
            title="วัตถุดิบที่หมด"
            emptyText="ไม่มีวัตถุดิบที่หมด"
            total={materials.count}
            names={materials.items.map((item) => item.material_name)}
          />
        )}
      </div>
    </section>
  );
}
