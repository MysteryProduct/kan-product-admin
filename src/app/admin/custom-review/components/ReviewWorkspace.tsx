'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/Button';
import { useToast } from '@/components/Toast';
import {
  OUTCOME_DOT,
  OUTCOME_LABEL,
  QUICK_REASONS,
  REASON_MAX,
  addQuickReason,
  fileBase,
  formatAt,
  formatTHB,
  isQueueStatus,
  layerRows,
  originalRows,
  statusView,
} from '@/lib/custom-review';
import type { ReviewDetail } from '@/types/custom-review';
import GlbOpener from './GlbOpener';
import ApproveDialog from './ApproveDialog';

export type ReviewAct = 'received' | 'needs_changes' | 'approved';

const STEP_TITLES = [
  'ชื่อไฟล์ PDF + ZIP ตรงกับคำขอและฉบับ',
  'ผู้รับและที่อยู่ตรงกับใบสั่งงาน',
  'แบบ 3D เปิดได้และตรงกับรายการ',
  'รายการและภาพต้นฉบับครบ',
];

const WarnIcon = () => (
  <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);

const addressOf = (r: ReviewDetail['recipient']) =>
  [r.addressLine1, r.addressLine2, r.district, r.province, r.postalCode].filter(Boolean).join(' ');

/**
 * One request under review: four check steps in the order of the Q4 checklist,
 * "ข้อมูลอื่น" collapsed, and the decision bar stuck to the bottom. The ticks live
 * on this screen only (Q4) and start over whenever the record is (re)loaded.
 */
export default function ReviewWorkspace({
  detail,
  backHref,
  can,
  canSeeSaleOrder,
  busy,
  conflict,
  onAct,
  onReload,
  onClearConflict,
}: {
  detail: ReviewDetail;
  backHref: string;
  can: { received: boolean; needsChanges: boolean; approve: boolean };
  canSeeSaleOrder: boolean;
  busy: ReviewAct | null;
  conflict: string | null;
  onAct: (act: ReviewAct, reason?: string) => Promise<boolean>;
  onReload: () => void;
  onClearConflict: () => void;
}) {
  const toast = useToast();
  const [ticks, setTicks] = useState([false, false, false, false]);
  const [form, setForm] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState(false);
  const [dialog, setDialog] = useState(false);
  // Ticks and the half-typed reason belong to the record as loaded.
  const [seen, setSeen] = useState(detail);
  if (seen !== detail) {
    setSeen(detail);
    setTicks([false, false, false, false]);
    if (detail.status !== 'reviewing') {
      setForm(false);
      setReason('');
      setReasonErr(false);
    }
  }

  const status = detail.status;
  const queued = isQueueStatus(status);
  const reviewing = status === 'reviewing' && !detail.hasJobOrder;
  // Approved stays true after production starts (in_production … shipped keep approved_revision): no 7-day warning or ticks then (D4).
  // A request back in the queue (a later revision under review) is reviewed again, whatever an earlier revision got.
  const approved = status === 'approved_for_production' || (!queued && detail.approvedRevision !== null);
  const base = fileBase(detail);
  const done = reviewing ? ticks.filter(Boolean).length : 0;
  const originals = detail.items.flatMap(originalRows);
  const last = detail.reviews[0];
  const lastNeeds = detail.reviews.find((r) => r.outcome === 'needs_changes');
  const approval = detail.reviews.find((r) => r.outcome === 'approved' && r.revision === detail.approvedRevision);
  const { label: statusText, dot: statusDot } = statusView(status);

  const copy = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      toast({ message: `คัดลอก ${name} แล้ว`, tone: 'success' });
    } catch {
      toast({ message: 'คัดลอกไม่สำเร็จ เลือกข้อความแล้วคัดลอกเอง', tone: 'danger' });
    }
  };

  const tickBox = (i: number) =>
    !approved && (
      <label className="ka-cr-tick">
        <input
          type="checkbox"
          checked={reviewing && ticks[i]}
          disabled={!reviewing}
          aria-describedby={`ka-cr-s${i + 1}`}
          onChange={() => setTicks((t) => t.map((v, j) => (j === i ? !v : v)))}
        />
        ตรวจแล้ว
      </label>
    );

  const stepHead = (i: number) => {
    const on = reviewing && ticks[i];
    return (
      <div className="ka-cr-sh">
        <span className="ka-cr-no" data-done={on || undefined} aria-hidden="true">
          {on ? <svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" /></svg> : i + 1}
        </span>
        <h3 id={`ka-cr-s${i + 1}`}>{STEP_TITLES[i]}</h3>
        {tickBox(i)}
      </div>
    );
  };

  const saveChanges = async () => {
    const text = reason.trim();
    if (!text) {
      setReasonErr(true);
      document.getElementById('ka-cr-reason')?.focus();
      return;
    }
    await onAct('needs_changes', text);
  };

  return (
    <section className="ka-cr-ws" aria-labelledby="ka-cr-wsh">
      <div className="ka-cr-whead">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <Link href={backHref} className="ka-btn ka-btn--ghost ka-btn--sm ka-cr-back" scroll={false}>
            <svg className="i i--s" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            คิว
          </Link>
          <h2 id="ka-cr-wsh">{detail.code}</h2>
          <div className="ka-cr-meta">
            <span className="ka-cr-st" data-dot={statusDot}>{statusText}</span>
            <span>ฉบับ {detail.revision}</span>
            {canSeeSaleOrder ? (
              <Link href={`/admin/sale-orders/${detail.saleOrderId}`} className="ka-cr-code">{detail.saleOrderCode}</Link>
            ) : (
              <span className="ka-cr-code">{detail.saleOrderCode}</span>
            )}
            <span className="ka-cr-buyer">{detail.buyer.name}</span>
          </div>
        </div>
        <p className="ka-cr-cap ka-cr-whead__last">
          {last ? `ล่าสุด: ${OUTCOME_LABEL[last.outcome]} · ${last.reviewer ?? 'ไม่ทราบชื่อผู้ตรวจ'} · ${formatAt(last.reviewedAt)}` : 'ยังไม่มีผลตรวจ'}
        </p>
      </div>

      <section className="ka-cr-sec" aria-labelledby="ka-cr-s1">
        {stepHead(0)}
        <ul className="ka-cr-files">
          <li className="ka-cr-fr">
            <span className="ka-cr-fr__ic">
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" /></svg>
            </span>
            <span className="ka-cr-fr__body">
              <span className="ka-cr-code">{base}_order.pdf</span>
              <span className="ka-cr-cap">ใบสั่งงาน ใช้เทียบกับขั้น 2 และ 4</span>
            </span>
            <button type="button" className="ka-cr-ib" aria-label="คัดลอกชื่อไฟล์ PDF" onClick={() => copy(`${base}_order.pdf`)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v11H8zM5 16V5h11" /></svg>
            </button>
          </li>
          <li className="ka-cr-fr">
            <span className="ka-cr-fr__ic">
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v12H4zM3 4h18v4H3zM10 12h4" /></svg>
            </span>
            <span className="ka-cr-fr__body">
              <span className="ka-cr-code">{base}_files.zip</span>
              <span className="ka-cr-zip">
                แตกแล้วได้ <span className="ka-cr-code">_model.glb</span> (ขั้น 3) · <span className="ka-cr-code">_order.json</span>
                {originals.length > 0 && (
                  <>
                    {' '}· <span className="ka-cr-code">originals/</span> (ขั้น 4)
                  </>
                )}{' '}
                · <span className="ka-cr-code">preview/</span> PNG ไว้ดูเท่านั้น ใช้แทน originals ไม่ได้
              </span>
            </span>
            <button type="button" className="ka-cr-ib" aria-label="คัดลอกชื่อไฟล์ ZIP" onClick={() => copy(`${base}_files.zip`)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v11H8zM5 16V5h11" /></svg>
            </button>
          </li>
        </ul>
        {!approved && (
          <p className="ka-cr-note">
            <WarnIcon />
            <span>Save PDF และ ZIP จากแชทลงเครื่องหรือไดรฟ์ร้านก่อน ไฟล์ในแชท LINE เปิดได้ราว 7 วันนับจากวันที่ลูกค้าส่ง ระบบนับให้ไม่ได้</span>
          </p>
        )}
      </section>

      <section className="ka-cr-sec" aria-labelledby="ka-cr-s2">
        {stepHead(1)}
        <dl className="ka-cr-dl">
          <div>
            <dt>ผู้สั่งซื้อ</dt>
            <dd>
              {detail.buyer.name} · <span className="ka-cr-num">{detail.buyer.phone}</span>
            </dd>
          </div>
          <div>
            <dt>ผู้รับ</dt>
            <dd>
              {detail.recipient.name} · <span className="ka-cr-num">{detail.recipient.phone}</span>
            </dd>
          </div>
          <div className="w">
            <dt>ที่อยู่จัดส่ง</dt>
            <dd>{addressOf(detail.recipient)}</dd>
          </div>
          <div className="w">
            <dt>หมายเหตุจากลูกค้า</dt>
            <dd>{detail.note?.trim() || 'ไม่มี'}</dd>
          </div>
        </dl>
      </section>

      <section className="ka-cr-sec" aria-labelledby="ka-cr-s3">
        {stepHead(2)}
        <GlbOpener
          key={detail.requestId}
          base={base}
          revision={detail.revision}
          label={`แบบ 3D ของ ${detail.code} ${detail.items.map((i) => i.templateName).join(' ')} ลากเพื่อหมุน`}
        />
      </section>

      <section className="ka-cr-sec" aria-labelledby="ka-cr-s4">
        {stepHead(3)}
        {detail.items.map((item) => {
          const rows = layerRows(item.design?.layers);
          const textOnly = rows.length > 0 && rows.every((r) => r.kind !== 'image');
          return (
            <div key={item.itemNo} className="ka-cr-itm">
              <div className="ka-cr-itm__h">
                <b>
                  {item.itemNo} · {item.templateName}
                </b>
                <span className="ka-cr-num">
                  {item.quantity} {item.saleUnit} × {formatTHB(item.unitPrice)}
                </span>
              </div>
              <p className="ka-cr-opts">
                {[item.options.map((o) => `${o.group} ${o.value}`).join(' · '), textOnly ? 'แบบข้อความล้วน ไม่ต้องมีไฟล์ใน originals/' : '']
                  .filter(Boolean)
                  .join(' · ') || 'ไม่มีตัวเลือก'}
              </p>
              {rows.length > 0 ? (
                <ol className="ka-cr-layers" aria-label={`ชั้นงานของรายการ ${item.itemNo}`}>
                  {rows.map((row) => (
                    <li key={row.no}>
                      <span className="k">ชั้น {row.no}</span>
                      <span className="k t">{row.kind === 'image' ? 'ภาพ' : row.kind === 'text' ? 'ข้อความ' : 'อื่น ๆ'}</span>
                      <span className={`v${row.kind === 'image' ? ' ka-cr-code' : ''}`}>
                        {row.kind === 'text' ? `“${row.value}”` : row.value}
                      </span>
                      <span className="ka-cr-cap ka-cr-num">{row.size ?? ''}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="ka-cr-cap">ไม่มีข้อมูลชั้นงานในคำขอ</p>
              )}
            </div>
          );
        })}
        {originals.length > 0 ? (
          <>
            <p className="ka-cr-sub">ต้องมีใน originals/ · {originals.length} ไฟล์ (ชื่อตามที่หน้าร้านเขียนลง ZIP)</p>
            <div className="ka-cr-tw">
              <table className="ka-cr-ot">
                <thead>
                  <tr>
                    <th scope="col">ไฟล์</th>
                    <th scope="col">ขนาด (px)</th>
                    <th scope="col">ใช้ใน</th>
                  </tr>
                </thead>
                <tbody>
                  {originals.map((o) => (
                    <tr key={`${o.itemNo}-${o.path}`}>
                      <td className="ka-cr-code">{o.path}</td>
                      <td className="ka-cr-num">{o.size}</td>
                      <td>
                        รายการ {o.itemNo} · ชั้น {o.layerNo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <details className="ka-cr-more" open={approved || status === 'needs_changes' || undefined}>
        <summary>
          <svg className="i i--s chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          ข้อมูลอื่น · ยอดรวม มัดจำ และประวัติผลตรวจ
        </summary>
        <div className="ka-cr-mgrid">
          <div>
            <p className="ka-cr-lbl">ยอดรวม</p>
            <div className="ka-cr-kv"><span>ยอดสินค้า</span><span className="ka-cr-num">{formatTHB(detail.subtotal)}</span></div>
            <div className="ka-cr-kv"><span>ค่าจัดส่ง</span><span className="ka-cr-num">{formatTHB(detail.shippingFee)}</span></div>
            {detail.total - detail.subtotal - detail.shippingFee > 0.004 && (
              <div className="ka-cr-kv">
                <span>VAT {detail.vatRate}%</span>
                <span className="ka-cr-num">{formatTHB(detail.total - detail.subtotal - detail.shippingFee)}</span>
              </div>
            )}
            <div className="ka-cr-kv ka-cr-kv--sum"><span>รวม</span><span className="ka-cr-num">{formatTHB(detail.total)}</span></div>
          </div>
          <div>
            <p className="ka-cr-lbl">
              มัดจำ ·{' '}
              <span className="ka-cr-st" data-dot={detail.depositPaid >= detail.depositRequired ? 'ok' : 'wn'}>
                {detail.depositPaid >= detail.depositRequired ? 'ชำระแล้ว' : 'ยังไม่ครบ'}
              </span>
            </p>
            <div className="ka-cr-kv"><span>ต้องชำระ</span><span className="ka-cr-num">{formatTHB(detail.depositRequired)}</span></div>
            <div className="ka-cr-kv"><span>ชำระแล้ว</span><span className="ka-cr-num">{formatTHB(detail.depositPaid)}</span></div>
            <div className="ka-cr-kv"><span>คงค้าง</span><span className="ka-cr-num">{formatTHB(detail.outstanding)}</span></div>
          </div>
          <div>
            <p className="ka-cr-lbl">ประวัติผลตรวจ</p>
            {detail.reviews.length > 0 ? (
              <ol className="ka-cr-tl">
                {detail.reviews.map((r, i) => (
                  <li key={`${r.reviewedAt}-${i}`}>
                    <span className="d" data-dot={OUTCOME_DOT[r.outcome]} />
                    <span style={{ minWidth: 0 }}>
                      <b>
                        {OUTCOME_LABEL[r.outcome]} · ฉบับ {r.revision}
                      </b>
                      <br />
                      <span className="ka-cr-cap">
                        {r.reviewer ?? 'ไม่ทราบชื่อผู้ตรวจ'} · {formatAt(r.reviewedAt)}
                      </span>
                      {r.reason && <q>{r.reason}</q>}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ka-cr-cap" style={{ fontSize: 14 }}>ยังไม่มีผลตรวจ</p>
            )}
          </div>
        </div>
      </details>

      <div className="ka-cr-bar" role="region" aria-label="ตัดสินผลตรวจ">
        {detail.hasJobOrder && !approved ? (
          <p className="ka-cr-note"><WarnIcon /><span>คำขอนี้มีใบผลิตแล้ว บันทึกผลตรวจไม่ได้</span></p>
        ) : !queued ? (
          <p className="ka-cr-note"><WarnIcon /><span>คำขอนี้{statusText} จึงไม่อยู่ในขั้นตรวจไฟล์</span></p>
        ) : status === 'awaiting_line_files' ? (
          <>
            <p className="ka-cr-note">
              <WarnIcon />
              <span>ได้รับ PDF + ZIP ครบแล้ว? Save ลงเครื่องก่อน ไฟล์ในแชทเปิดได้ราว 7 วัน</span>
            </p>
            <div className="ka-cr-acts">
              {can.received ? (
                <Button variant="action" loading={busy === 'received'} onClick={() => onAct('received')}>ได้รับไฟล์แล้ว</Button>
              ) : (
                <span className="ka-cr-cap">ไม่มีสิทธิ์บันทึกรับไฟล์</span>
              )}
            </div>
          </>
        ) : status === 'needs_changes' ? (
          <>
            <div className="ka-cr-bar__p">
              <b>ขอให้แก้แล้ว · รอไฟล์ชุดใหม่ของฉบับ {detail.revision}</b>
              {lastNeeds?.reason && <span className="ka-cr-cap">“{lastNeeds.reason}”</span>}
            </div>
            <div className="ka-cr-acts">
              {can.received ? (
                <Button variant="action" loading={busy === 'received'} onClick={() => onAct('received')}>ได้รับไฟล์ชุดใหม่แล้ว</Button>
              ) : (
                <span className="ka-cr-cap">ไม่มีสิทธิ์บันทึกรับไฟล์</span>
              )}
            </div>
          </>
        ) : approved ? (
          <p className="ka-cr-okline">
            <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6" /></svg>
            <span>
              <b>อนุมัติฉบับ {detail.approvedRevision ?? detail.revision} ให้ผลิตแล้ว</b>
              {approval && ` · ${approval.reviewer ?? 'ไม่ทราบชื่อผู้ตรวจ'} · ${formatAt(approval.reviewedAt)}`} · ย้อนผลไม่ได้
            </span>
          </p>
        ) : form ? (
          <div className="ka-cr-form">
            <label htmlFor="ka-cr-reason">
              เหตุผลที่ขอให้แก้ (ใช้ภายในร้าน) <span className="ka-cr-req" aria-hidden="true">*</span>
            </label>
            <div className="ka-cr-qcs" role="group" aria-label="ข้อความที่ใช้บ่อย">
              {QUICK_REASONS.map((phrase) => {
                const next = addQuickReason(reason, phrase);
                return (
                  <button
                    key={phrase}
                    type="button"
                    className="ka-cr-qc"
                    disabled={next === null}
                    onClick={() => {
                      if (next === null) return;
                      setReason(next);
                      setReasonErr(false);
                    }}
                  >
                    + {phrase}
                  </button>
                );
              })}
            </div>
            <textarea
              id="ka-cr-reason"
              className="ka-cr-in"
              maxLength={REASON_MAX}
              required
              aria-invalid={reasonErr || undefined}
              aria-describedby={reasonErr ? 'ka-cr-reason-err ka-cr-reason-note' : 'ka-cr-reason-note'}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonErr) setReasonErr(false);
              }}
              placeholder="เช่น ZIP เปิดไม่ได้ ขอให้ส่งไฟล์ชุดใหม่ของฉบับเดิม"
            />
            {reasonErr && (
              <span className="ka-cr-ferr" id="ka-cr-reason-err">
                <svg className="i i--s" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01" /></svg>
                กรอกเหตุผลที่ขอให้แก้ก่อนบันทึก
              </span>
            )}
            <div className="ka-cr-frow">
              <span className="ka-cr-cap" id="ka-cr-reason-note">
                ลูกค้าเห็นใน Store แค่ “ร้านขอให้แก้แบบ ดูรายละเอียดในแชท LINE” แจ้งรายละเอียดในแชทเอง · ถ้าลูกค้าจะเปลี่ยนแบบ ให้ยกเลิกแล้วสั่งใหม่ ·{' '}
                <span className="ka-cr-num">
                  {reason.length}/{REASON_MAX}
                </span>
              </span>
              <div className="ka-cr-acts">
                <Button variant="ghost" disabled={busy !== null} onClick={() => { setForm(false); setReasonErr(false); }}>ยกเลิก</Button>
                <Button variant="action" loading={busy === 'needs_changes'} onClick={saveChanges}>บันทึกขอให้แก้</Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="ka-cr-bar__p">
              <b>{done === 4 ? 'ตรวจครบ 4 ข้อ · พร้อมอนุมัติ' : `ตรวจแล้ว ${done} จาก 4 · ติ๊กครบเพื่ออนุมัติ`}</b>
              <div className="ka-cr-meter" aria-hidden="true"><i style={{ transform: `scaleX(${done / 4})` }} /></div>
            </div>
            <div className="ka-cr-acts">
              {can.needsChanges && (
                <Button onClick={() => { setForm(true); setReasonErr(false); }}>ขอให้แก้</Button>
              )}
              {can.approve && (
                <Button variant="action" disabled={done < 4} onClick={() => { onClearConflict(); setDialog(true); }}>อนุมัติแบบให้ผลิต</Button>
              )}
              {!can.needsChanges && !can.approve && <span className="ka-cr-cap">ไม่มีสิทธิ์บันทึกผลตรวจ</span>}
            </div>
          </>
        )}
      </div>

      {reviewing && can.approve && (
        <ApproveDialog
          detail={detail}
          originals={originals.length}
          open={dialog}
          pending={busy === 'approved'}
          conflict={conflict}
          onClose={() => setDialog(false)}
          onApprove={async () => {
            if (await onAct('approved')) setDialog(false);
          }}
          onReload={() => {
            setDialog(false);
            onReload();
          }}
        />
      )}
    </section>
  );
}
