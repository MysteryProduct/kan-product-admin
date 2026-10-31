"use client";

import Cookies from "js-cookie";
import Link from "next/link";
import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import CustomSelect from "@/components/CustomSelect";
import { useToast } from "@/components/Toast";
import MaterialModel from "@/models/material";
import PurchaseOrderModel from "@/models/purchase-order";
import SupplierModel from "@/models/supplier";
import { ProductUnitModel } from "@/models/product-unit";
import { calculateVatSummary, type VatType } from "@/lib/vat";
import useVatRate from "@/hooks/useVatRate";
import { getApiErrorMessage } from "@/lib/api-error";
import type { Material } from "@/types/material";
import type { SupplierWithPayment } from "@/types/supplier";
import type { ProductUnit } from "@/types/product-unit";

const materialModel = new MaterialModel();
const purchaseOrderModel = new PurchaseOrderModel();
const supplierModel = new SupplierModel();
const productUnitModel = new ProductUnitModel();

const baht = (value: number) =>
  `฿${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

interface PurchaseDraftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The materials that ran out; the first is chosen to start. */
  materials: { material_id: string; material_name: string }[];
}

/**
 * "สร้างใบสั่งซื้อ" from the out-of-materials card: one material, a quantity, a supplier and a
 * unit, saved through the same endpoint as the purchase page as a draft (TASK-0320), priced at
 * the material's price, so purchasing checks it and submits it for approval.
 */
export default function PurchaseDraftDialog({ isOpen, onClose, materials }: PurchaseDraftDialogProps) {
  const toast = useToast();
  const vatRate = useVatRate();
  const [materialId, setMaterialId] = useState(materials[0]?.material_id ?? "");
  const [material, setMaterial] = useState<Material | null>(null);
  const [qty, setQty] = useState("1");
  const [supplierId, setSupplierId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierWithPayment[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void supplierModel.getSuppliers(1, 100, "").then((response) => setSuppliers(response.data)).catch(() => setSuppliers([]));
    void productUnitModel.getAllProductUnits("").then((response) => setUnits(response.data)).catch(() => setUnits([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !materialId) return;
    let live = true;
    materialModel
      .getMaterialById(materialId)
      .then((loaded) => live && setMaterial(loaded))
      .catch(() => live && setMaterial(null));
    return () => {
      live = false;
    };
  }, [isOpen, materialId]);

  const quantity = Number(qty);
  const price = Number(material?.material_price ?? 0);
  const supplier = suppliers.find((item) => item.supplier_id === supplierId);
  const vatType = (supplier?.vat_type ?? "none") as VatType;
  const summary = calculateVatSummary(Number.isInteger(quantity) && quantity > 0 ? quantity * price : 0, vatType, vatRate);
  const name = materials.find((item) => item.material_id === materialId)?.material_name ?? material?.material_name ?? "";

  const save = async () => {
    const next: Record<string, string> = {};
    if (!materialId) next.material = "เลือกวัตถุดิบ";
    if (!Number.isInteger(quantity) || quantity < 1) next.qty = "จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1";
    if (!supplierId) next.supplier = "เลือกผู้จำหน่าย";
    if (!unitId) next.unit = "เลือกหน่วยนับ";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const user = Cookies.get("user") ? JSON.parse(Cookies.get("user") as string) : null;
    if (!user) {
      setSaveError("ไม่พบผู้ใช้ที่เข้าสู่ระบบ ลองเข้าสู่ระบบใหม่");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const created = await purchaseOrderModel.createPurchaseOrder({
        purchase_order_name: `เติมวัตถุดิบ ${name}`,
        purchase_order_detail: "สร้างจาก Dashboard › วัตถุดิบหมด",
        supplier_id: supplierId,
        vat_type: vatType,
        purchase_order_subtotal: summary.subtotal,
        purchase_order_vat_amount: summary.vatAmount,
        purchase_order_total: summary.total,
        create_by: user.employee_id,
        save_as_draft: true,
        purchaseOrderLists: [
          {
            material_id: materialId,
            purchase_order_list_qty: quantity,
            purchase_order_list_price: price,
            purchase_order_list_total: quantity * price,
            product_unit_id: Number(unitId),
          },
        ],
      });
      toast({ message: `สร้างใบสั่งซื้อฉบับร่าง ${created?.purchase_order_code ?? ""} แล้ว ส่งอนุมัติได้ในหน้าจัดซื้อ`.replace("  ", " ") });
      onClose();
    } catch (error) {
      setSaveError(`บันทึกไม่สำเร็จ ${getApiErrorMessage(error)} ข้อมูลที่กรอกยังอยู่`);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <span id={`pd-${key}-error`} className="ka-error" role="alert">
        {errors[key]}
      </span>
    ) : null;

  return (
    <Modal
      guardUnsaved
      isOpen={isOpen}
      onClose={onClose}
      title="สร้างใบสั่งซื้อ"
      description="เติมวัตถุดิบที่หมด"
      size="standard"
      footer={
        <>
          <button type="button" className="ka-btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="button" className="ka-btn ka-btn--primary" disabled={saving} onClick={() => void save()}>
            {saving ? "กำลังบันทึก…" : "สร้างฉบับร่าง"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        {saveError && (
          <p className="ka-banner ka-banner--danger" role="alert">
            {saveError}
          </p>
        )}
        {materials.length > 1 ? (
          <div className="ka-field">
            <label htmlFor="pd-material" className="ka-label">วัตถุดิบ <span className="ka-req">*</span></label>
            <CustomSelect
              id="pd-material"
              value={materialId}
              onChange={setMaterialId}
              options={materials.map((item) => ({ value: item.material_id, label: item.material_name }))}
              aria-invalid={Boolean(errors.material)}
              aria-describedby={errors.material ? "pd-material-error" : undefined}
            />
            {fieldError("material")}
          </div>
        ) : (
          <div className="ka-qlist">
            <div className="ka-qrow">
              <div className="ka-qrow__main">
                <span className="font-semibold">{material?.material_code ? `${material.material_code} · ` : ""}{name}</span>
                <p className="ka-qrow__meta">คงเหลือ 0</p>
              </div>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="ka-field">
            <label htmlFor="pd-qty" className="ka-label">จำนวน <span className="ka-req">*</span></label>
            <input
              id="pd-qty"
              className="ka-input numeric text-right"
              inputMode="numeric"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              aria-invalid={Boolean(errors.qty) || undefined}
              aria-describedby={errors.qty ? "pd-qty-error" : undefined}
            />
            {fieldError("qty")}
          </div>
          <div className="ka-field">
            <label htmlFor="pd-supplier" className="ka-label">ผู้จำหน่าย <span className="ka-req">*</span></label>
            <CustomSelect
              id="pd-supplier"
              value={supplierId}
              onChange={setSupplierId}
              placeholder="เลือกผู้จำหน่าย"
              options={suppliers.map((item) => ({ value: item.supplier_id, label: item.supplier_name }))}
              aria-invalid={Boolean(errors.supplier)}
              aria-describedby={errors.supplier ? "pd-supplier-error" : undefined}
            />
            {fieldError("supplier")}
          </div>
        </div>
        <div className="ka-field">
          <label htmlFor="pd-unit" className="ka-label">หน่วยนับ <span className="ka-req">*</span></label>
          <CustomSelect
            id="pd-unit"
            value={unitId}
            onChange={setUnitId}
            placeholder="เลือกหน่วยนับ"
            options={units.map((item) => ({ value: item.product_unit_id, label: item.product_unit_name }))}
            aria-invalid={Boolean(errors.unit)}
            aria-describedby={errors.unit ? "pd-unit-error" : undefined}
          />
          {fieldError("unit")}
        </div>
        <p className="ka-todo__cap numeric">
          ราคาต่อหน่วย {baht(price)} จากข้อมูลวัตถุดิบ · ยอดรวม {baht(summary.total)}
        </p>
        <p className="ka-banner ka-banner--info">
          ใบสั่งซื้อจะเป็นฉบับร่าง ตรวจราคาและส่งอนุมัติได้ใน
          {" "}
          <Link href="/admin/purchase-orders" className="font-semibold underline">หน้าจัดซื้อ</Link>
        </p>
      </div>
    </Modal>
  );
}
