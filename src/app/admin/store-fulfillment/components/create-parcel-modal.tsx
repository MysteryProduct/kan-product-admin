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

const inputClass =
  'min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2';

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
      isOpen={isOpen}
      onClose={onClose}
      title="บันทึกพัสดุใหม่"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending}
            className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? 'กำลังบันทึก...' : 'บันทึกพัสดุ'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 text-[var(--color-text-primary)]">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">ขนส่ง</span>
          <input
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">เลขพัสดุ</span>
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium">รายการสินค้า (คงเหลือยังไม่ส่ง)</span>
          {shippable.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              ไม่มีรายการที่ยังไม่ได้ส่ง
            </p>
          )}
          {shippable.map((line) => (
            <div
              key={line.saleOrderListId}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2"
            >
              <div className="text-sm">
                <p>{line.productName}</p>
                <p className="text-[var(--color-text-secondary)]">
                  คงเหลือ {line.remainingUnshipped} จาก {line.purchasedQty}
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={line.remainingUnshipped}
                value={quantities[line.saleOrderListId] ?? 0}
                onChange={(e) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [line.saleOrderListId]: Math.max(
                      0,
                      Math.min(line.remainingUnshipped, Number(e.target.value)),
                    ),
                  }))
                }
                className="min-h-11 w-20 rounded-lg border border-[var(--color-border)] px-2 py-1 text-right"
              />
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overrideAddress}
            onChange={(e) => setOverrideAddress(e.target.checked)}
          />
          <span>ใช้ที่อยู่อื่นสำหรับพัสดุนี้ (ค่าเริ่มต้นคือที่อยู่ของคำสั่งซื้อ)</span>
        </label>
        {overrideAddress && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span>ชื่อผู้รับ</span>
              <input
                value={address.recipient_name}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, recipient_name: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>เบอร์โทรผู้รับ</span>
              <input
                value={address.recipient_phone}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, recipient_phone: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span>ที่อยู่ บรรทัดที่ 1</span>
              <input
                value={address.address_line1}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, address_line1: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span>ที่อยู่ บรรทัดที่ 2 (ไม่บังคับ)</span>
              <input
                value={address.address_line2}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, address_line2: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>อำเภอ/เขต</span>
              <input
                value={address.district}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, district: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>จังหวัด</span>
              <input
                value={address.province}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, province: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>รหัสไปรษณีย์</span>
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
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
