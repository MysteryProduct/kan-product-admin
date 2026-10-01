// Thai names for the blocks the API can report as `unavailable`.
const BLOCK_LABELS: Record<string, string> = {
  'sales.received': 'ยอดที่รับชำระจริง',
  'sales.approved': 'ยอดใบขายที่อนุมัติ',
  'sales.store_orders': 'คำสั่งซื้อหน้าร้านที่ชำระแล้ว',
  'top_products.items': 'สินค้าขายดี',
  'cashflow.income': 'รายรับ',
  'cashflow.expense': 'รายจ่าย',
  'cashflow.purchases': 'มูลค่าซื้อเข้า',
  'pending_work.sale_orders_to_approve': 'ใบขายรออนุมัติ',
  'pending_work.store_orders_to_review': 'คำสั่งซื้อหน้าร้านที่รอตรวจ',
  'pending_work.store_orders_to_ship': 'รอจัดส่ง',
  'pending_work.store_orders_to_pickup': 'รอรับที่ร้าน',
  'pending_work.contact_requests_new': 'คำขอติดต่อกลับใหม่',
  'pending_work.purchase_orders_to_approve': 'ใบสั่งซื้อรออนุมัติ',
  'stock_out.products': 'สินค้าที่หมด',
  'stock_out.materials': 'วัตถุดิบที่หมด',
  'operations.job_orders': 'งานผลิต',
  'operations.purchase_orders_to_receive': 'ใบสั่งซื้อรอรับสินค้า',
  'operations.supplier_invoices': 'ใบแจ้งหนี้ผู้จัดจำหน่าย',
};

/** "โหลดข้อมูลบางส่วนไม่สำเร็จ: …" for the blocks that failed, or null when none did. */
export function unavailableText(blocks: string[] | undefined): string | null {
  if (!blocks || blocks.length === 0) return null;
  return `โหลดข้อมูลบางส่วนไม่สำเร็จ: ${blocks.map((block) => BLOCK_LABELS[block] ?? block).join(', ')}`;
}
