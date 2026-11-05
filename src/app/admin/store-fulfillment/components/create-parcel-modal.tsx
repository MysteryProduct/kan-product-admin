'use client';
import { useState } from 'react';
import Modal from '@/components/Modal';
import StoreFulfillmentModel from '@/models/store-fulfillment';
import {
  StoreOrderDefaultAddress,
  StoreOrderLine,
} from '@/types/store-fulfillment';
import { getApiErrorMessage } from '@/lib/api-error';

const storeFulfillmentModel = new StoreFulfillmentModel();

const inputClass = 'ka-input';

interface CreateParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  storeOrderId: string;
  lines: StoreOrderLine[];
  defaultAddress: StoreOrderDefaultAddress | null;
}

export default function CreateParcelModal({
  isOpen,
  onClose,
  onSuccess,
  storeOrderId,
  lines,
  defaultAddress,
}: CreateParcelModalProps) {
  const shippable = lines.filter((line) => line.remainingUnshipped > 0);

  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [overrideAddress, setOverrideAddress] = useState(false);
  const [address, setAddress] = useState({
    recipient_name: defaultAddress?.recipientName ?? '',
    recipient_phone: defaultAddress?.recipientPhone ?? '',
    address_line1: defaultAddress?.addressLine1 ?? '',
    address_line2: defaultAddress?.addressLine2 ?? '',
    district: defaultAddress?.district ?? '',
    province: defaultAddress?.province ?? '',
    postal_code: defaultAddress?.postalCode ?? '',
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  // Whole pieces, from none up to what is still unshipped.
  function setQuantity(line: StoreOrderLine, value: number) {
    setQuantities((prev) => ({
      ...prev,
      [line.saleOrderListId]: Math.max(0, Math.min(line.remainingUnshipped, Math.floor(value) || 0)),
    }));
  }

  async function handleSubmit() {
    const items = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([sale_order_list_id, quantity]) => ({
        sale_order_list_id,
        quantity,
      }));
    if (!carrierName.trim() || !trackingNumber.trim()) {
      setError('กรุณากรอกขนส่งและเลขพัสดุ');
      return;
    }
    if (items.length === 0) {
      setError('กรุณาระบุจำนวนสินค้าอย่างน้อยหนึ่งรายการ');
      return;
    }

    setPending(true);
    setError('');
    try {
      await storeFulfillmentModel.createParcel(storeOrderId, {
        carrier_name: carrierName.trim(),
        tracking_number: trackingNumber.trim(),
        items,
        ...(overrideAddress ? address : {}),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      guardUnsaved={!pending}
      className="ka-sf-modal ka-sf-modal--wide"
      closeOnBackdrop={!pending}
      closeOnEscape={!pending}
      isOpen={isOpen}
      onClose={() => {
        // Not while saving: the parcel may already exist, and a failure needs this dialog to appear in.
        if (!pending) onClose();
      }}
      title="บันทึกพัสดุใหม่"
      size="wide"
      footer={
        <>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="ka-btn"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending}
            className="ka-btn ka-btn--primary"
          >
            {pending ? 'กำลังบันทึก...' : 'บันทึกพัสดุ'}
          </button>
        </>
      }
    >
      <div className="ka-sf-form">
        <div className="ka-sf-form2">
        <label className="ka-field">
          <span className="ka-label">ขนส่ง</span>
          <input
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>
        <label className="ka-field">
          <span className="ka-label">เลขพัสดุ</span>
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>
        </div>

        <div>
          <span className="ka-label">รายการสินค้า (คงเหลือยังไม่ส่ง)</span>
          {shippable.length === 0 && (
            <p className="ka-sf-sub">
              ไม่มีรายการที่ยังไม่ได้ส่ง
            </p>
          )}
          {shippable.map((line) => (
            <div
              key={line.saleOrderListId}
              className="ka-sf-qline"
            >
              <div className="min-w-0">
                <p>{line.productName}</p>
                <p className="ka-sf-cap">
                  คงเหลือ {line.remainingUnshipped} จาก {line.purchasedQty}
                </p>
              </div>
              <div className="ka-step ka-sf-stepper" role="group" aria-label={`จำนวนของ ${line.productName} ในพัสดุนี้`}>
                <button
                  type="button"
                  aria-label="ลดจำนวน"
                  disabled={(quantities[line.saleOrderListId] ?? 0) <= 0}
                  onClick={() => setQuantity(line, (quantities[line.saleOrderListId] ?? 0) - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={line.remainingUnshipped}
                  aria-label={`จำนวนของ ${line.productName}`}
                  value={quantities[line.saleOrderListId] ?? 0}
                  onChange={(e) => setQuantity(line, Number(e.target.value))}
                />
                <button
                  type="button"
                  aria-label="เพิ่มจำนวน"
                  disabled={(quantities[line.saleOrderListId] ?? 0) >= line.remainingUnshipped}
                  onClick={() => setQuantity(line, (quantities[line.saleOrderListId] ?? 0) + 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {!overrideAddress && defaultAddress?.addressLine1 && (
          <div className="ka-sf-panel">
            <p>
              {defaultAddress.recipientName} · {defaultAddress.recipientPhone}
            </p>
            <p className="ka-sf-cap">
              {[defaultAddress.addressLine1, defaultAddress.addressLine2, defaultAddress.district, defaultAddress.province, defaultAddress.postalCode]
                .filter(Boolean)
                .join(' ')}
            </p>
          </div>
        )}

        <label className="ka-sf-check">
          <input
            type="checkbox"
            checked={overrideAddress}
            onChange={(e) => setOverrideAddress(e.target.checked)}
          />
          <span>ใช้ที่อยู่อื่นสำหรับพัสดุนี้ (ค่าเริ่มต้นคือที่อยู่ของคำสั่งซื้อ)</span>
        </label>
        {overrideAddress && (
          <div className="ka-sf-form2">
            <label className="ka-field">
              <span className="ka-label">ชื่อผู้รับ</span>
              <input
                value={address.recipient_name}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, recipient_name: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="ka-field">
              <span className="ka-label">เบอร์โทรผู้รับ</span>
              <input
                value={address.recipient_phone}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, recipient_phone: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="ka-field ka-sf-wide">
              <span className="ka-label">ที่อยู่ บรรทัดที่ 1</span>
              <input
                value={address.address_line1}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, address_line1: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="ka-field ka-sf-wide">
              <span className="ka-label">ที่อยู่ บรรทัดที่ 2 (ไม่บังคับ)</span>
              <input
                value={address.address_line2}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, address_line2: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="ka-field">
              <span className="ka-label">อำเภอ/เขต</span>
              <input
                value={address.district}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, district: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="ka-field">
              <span className="ka-label">จังหวัด</span>
              <input
                value={address.province}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, province: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="ka-field">
              <span className="ka-label">รหัสไปรษณีย์</span>
              <input
                value={address.postal_code}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, postal_code: e.target.value }))
                }
                className={inputClass}
              />
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className="ka-sf-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
