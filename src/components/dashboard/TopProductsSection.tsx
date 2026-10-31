import { formatBaht } from '@/components/charts/scale';
import HBar from '@/components/dashboard/HBar';
import LoadErrorBanner from '@/components/LoadErrorBanner';
import { unavailableText } from '@/components/dashboard/blockLabels';
import type { TopProducts } from '@/types/dashboard';

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);
const rank = (value: number) => String(value).padStart(2, '0');

interface TopProductsSectionProps {
  data: TopProducts | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * The ten best sellers of the page's period as horizontal bars. The bar is only the proportion; each
 * row says its rank, name and units in text, and the table beneath adds the amount, so nothing is
 * read from colour or length alone.
 */
export default function TopProductsSection({ data, loading, error, onRetry }: TopProductsSectionProps) {
  const items = data?.items;
  const max = Math.max(1, ...(items ?? []).map((item) => item.quantity));

  return (
    <section aria-labelledby="sales-top-products" className="ka-card ka-panel" aria-busy={loading || undefined}>
      <div className="ka-panel__head">
        <h2 id="sales-top-products" className="ka-card__title">สินค้าขายดี</h2>
        <span className="ka-todo__cap">ใบขายที่อนุมัติ หักจำนวนที่คืน</span>
      </div>

      <LoadErrorBanner message={error ?? unavailableText(data?.unavailable)} onRetry={onRetry} />
      {loading && !data && <p className="ka-panel__note">กำลังโหลด...</p>}
      {data && !items && !data.unavailable && <p className="ka-panel__note">ยังไม่มีข้อมูลที่แสดงได้ตามสิทธิ์ของคุณ</p>}
      {data && items && items.length === 0 && <p className="ka-panel__note">ยังไม่มีสินค้าที่ขายได้ในช่วงเวลานี้</p>}

      {data && items && items.length > 0 && (
        <>
          <ol aria-label="สินค้าขายดีเรียงตามจำนวนที่ขายได้" className="ka-rank">
            {items.map((item) => (
              <li key={`${item.rank}-${item.name}`}>
                <div className="ka-rank__row">
                  <span className="ka-rank__name">
                    <span className="ka-rank__no numeric">{rank(item.rank)}</span>
                    <span className="min-w-0 break-words">{item.name}</span>
                  </span>
                  <span className="numeric ka-rank__qty">{count(item.quantity)} ชิ้น</span>
                </div>
                <HBar ratio={item.quantity / max} />
              </li>
            ))}
          </ol>
          <p className="ka-panel__note">
            นับใบขายที่อนุมัติแล้ว (ไม่รวมใบที่ยังไม่อนุมัติ ยกเลิก หรือคืนทั้งใบ) หักจำนวนที่คืนแล้ว รวมทุกสีและขนาดของสินค้านั้น
          </p>
          <details className="mt-1">
            <summary className="ka-panel__link cursor-pointer">ดูเป็นตาราง</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="ka-table w-full text-[13px]">
                <caption className="sr-only">สินค้าขายดี 10 อันดับ</caption>
                <thead>
                  <tr>
                    <th scope="col">อันดับ</th>
                    <th scope="col">สินค้า</th>
                    <th scope="col" className="text-right">จำนวน (ชิ้น)</th>
                    <th scope="col" className="text-right">มูลค่าตามราคาในรายการ</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.rank}-${item.name}`}>
                      <td>{item.rank}</td>
                      <td className="break-words">{item.name}</td>
                      <td className="numeric text-right">{count(item.quantity)}</td>
                      <td className="numeric whitespace-nowrap text-right">{formatBaht(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
