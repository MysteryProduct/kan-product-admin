import { formatBaht } from '@/components/charts/scale';
import HBar from '@/components/dashboard/HBar';
import LoadErrorBanner from '@/components/LoadErrorBanner';
import { unavailableText } from '@/components/dashboard/blockLabels';
import type { SalesMix } from '@/types/dashboard';

// Each known payment method keeps its own swatch; anything else (and a receipt with no method recorded)
// is one "other" row, so a colour means one thing. The rows name every colour, so a colour never stands alone.
const METHODS: Record<string, { label: string; color: string }> = {
  card: { label: 'บัตรเครดิต/เดบิต', color: 'var(--brand)' },
  promptpay: { label: 'พร้อมเพย์', color: 'var(--border-control)' },
  cash: { label: 'เงินสด', color: 'var(--chart-3)' },
  transfer: { label: 'โอนเงิน', color: 'var(--chart-4)' },
  bank: { label: 'โอนเงิน', color: 'var(--chart-4)' },
};
const OTHER_METHOD = { label: 'อื่น ๆ / ไม่ระบุ', color: 'var(--chart-5)' };

const CHANNELS: Record<string, string> = {
  store: 'หน้าร้านออนไลน์ (Store)',
  online: 'ขายบนเว็บไซต์',
  website: 'ขายบนเว็บไซต์',
  order: 'หลังร้าน (ขายจากการสั่งซื้อ)',
};

const count = (value: number) => new Intl.NumberFormat('th-TH').format(value);
const share = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '-');

interface SalesMixSectionProps {
  data: SalesMix | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * How the period's receipts split by payment method (one bar cut into parts; refunds stated apart) and how
 * its sales split by channel (a bar per channel). No ring: the parts and their shares are written out.
 */
export default function SalesMixSection({ data, loading, error, onRetry }: SalesMixSectionProps) {
  const methods: { label: string; color: string; amount: number }[] = [];
  for (const item of data?.payment_methods?.items ?? []) {
    const known = item.method ? METHODS[item.method] : undefined;
    const label = known ? known.label : OTHER_METHOD.label;
    const existing = methods.find((method) => method.label === label);
    if (existing) existing.amount += item.amount;
    else methods.push({ label, color: known ? known.color : OTHER_METHOD.color, amount: item.amount });
  }
  const methodTotal = methods.reduce((sum, method) => sum + method.amount, 0);

  // Types with the same name (online and website) are one channel.
  const channels: { label: string; count: number; amount: number }[] = [];
  for (const item of data?.channels ?? []) {
    const label = CHANNELS[item.type] ?? item.type;
    const existing = channels.find((channel) => channel.label === label);
    if (existing) {
      existing.count += item.count;
      existing.amount += item.amount;
    } else channels.push({ label, count: item.count, amount: item.amount });
  }
  channels.sort((a, b) => b.amount - a.amount);
  const channelTotal = channels.reduce((sum, channel) => sum + channel.amount, 0);
  const maxAmount = Math.max(1, ...channels.map((channel) => channel.amount));
  const hasShown = Boolean(data?.payment_methods || data?.channels);

  return (
    <div className="ka-sales-mix" aria-busy={loading || undefined}>
      <LoadErrorBanner message={error ?? unavailableText(data?.unavailable)} onRetry={onRetry} className="ka-sales-mix__banner" />
      {loading && !data && <p className="ka-panel__note">กำลังโหลด...</p>}
      {data && !hasShown && !data.unavailable && <p className="ka-panel__note">ยังไม่มีข้อมูลที่แสดงได้ตามสิทธิ์ของคุณ</p>}

      {data?.payment_methods && (
        <section className="ka-card ka-panel" aria-labelledby="sales-payment-methods">
          <div className="ka-panel__head">
            <h2 id="sales-payment-methods" className="ka-card__title">ตามวิธีชำระเงิน</h2>
            <span className="ka-todo__cap numeric">ก่อนคืนเงิน {formatBaht(methodTotal)}</span>
          </div>
          {methods.length > 0 ? (
            <>
              <div
                className="ka-stack"
                role="img"
                aria-label={methods.map((method) => `${method.label} ${share(method.amount, methodTotal)}`).join(' ')}
              >
                {methods.map((method) => (
                  <span key={method.label} style={{ flexGrow: method.amount, ['--seg' as string]: method.color }} />
                ))}
              </div>
              <ul className="ka-kv">
                {methods.map((method) => (
                  <li key={method.label}>
                    <span className="ka-kv__key">
                      <i className="ka-swatch" style={{ background: method.color }} aria-hidden="true" />
                      {method.label}
                    </span>
                    <span className="numeric">
                      <b>{formatBaht(method.amount)}</b> <span className="ka-todo__cap">· {share(method.amount, methodTotal)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="ka-panel__note">ยังไม่มีรายรับในช่วงเวลานี้</p>
          )}
          <p className="ka-kv__line">
            <span>คืนเงินในช่วงนี้ (แยกจากสัดส่วน)</span>
            <span className="numeric">{formatBaht(data.payment_methods.refunded)}</span>
          </p>
        </section>
      )}

      {data?.channels && (
        <section className="ka-card ka-panel" aria-labelledby="sales-channels">
          <div className="ka-panel__head">
            <h2 id="sales-channels" className="ka-card__title">ตามช่องทาง</h2>
            <span className="ka-todo__cap">{count(channels.length)} ช่องทาง</span>
          </div>
          {channels.length > 0 ? (
            <ul aria-label="ยอดขายแยกตามช่องทาง" className="ka-rank">
              {channels.map((channel) => (
                <li key={channel.label}>
                  <div className="ka-rank__row">
                    <span className="min-w-0 break-words">{channel.label}</span>
                    <span className="numeric ka-rank__qty">{formatBaht(channel.amount)}</span>
                  </div>
                  <HBar ratio={channel.amount / maxAmount} />
                  <span className="ka-todo__cap numeric">
                    {count(channel.count)} ใบ · {share(channel.amount, channelTotal)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ka-panel__note">ยังไม่มียอดขายในช่วงเวลานี้</p>
          )}
          <p className="ka-panel__note">นับใบขายที่อนุมัติแล้ว ตามยอดรวมของใบ (รวม VAT และค่าส่ง) ยังไม่หักใบที่คืนภายหลัง</p>
        </section>
      )}
    </div>
  );
}
