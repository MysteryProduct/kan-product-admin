import type { Product, ProductVariant } from '@/types/product';
import type { StorePolicyChange, StorePolicyState, VariantStatusValue } from '@/models/product';

// Pure helpers for the product table's group commands (TASK-0160): the choices
// the panel offers and the before/after lines the confirmation step shows.

export const variantsOf = (product: Product): ProductVariant[] =>
  product.product_variants || product.productVariants || [];

// The API stores 'active' or 'inactive' from the form; rows created before the
// form had a choice carry the column default 'available', which sells like 'active'.
export const variantStatusOf = (variant: ProductVariant): VariantStatusValue =>
  (variant.product_variant_status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';

export const STATUS_LABELS: Record<VariantStatusValue, string> = {
  active: 'เปิดใช้งาน',
  inactive: 'ปิดใช้งาน',
};

export const POLICY_LABELS: Record<keyof StorePolicyChange, string> = {
  published: 'แสดงบนหน้าร้าน',
  online_purchase: 'อนุญาตซื้อออนไลน์',
  contact_enabled: 'อนุญาตติดต่อกลับ',
};

export const variantLabel = (variant: ProductVariant) =>
  [variant.size?.size_name, variant.color?.color_name].filter(Boolean).join(' / ') || 'ตัวเลือกสินค้า';

export interface PreviewLine {
  /** Stable React key and the identity of the target (product or variant id). */
  key: string;
  title: string;
  detail?: string;
  before: string;
  after: string;
}

const onOff = (value: boolean) => (value ? 'เปิด' : 'ปิด');

export function categoryPreview(products: Product[], categoryName: string): PreviewLine[] {
  return products.map((product) => ({
    key: product.product_id,
    title: product.product_name,
    before: product.category?.category_name || '-',
    after: categoryName,
  }));
}

/** One line per product and changed switch; an unread policy shows as unknown, not as off. */
export function policyPreview(
  products: Product[],
  policies: ReadonlyMap<string, StorePolicyState>,
  change: StorePolicyChange,
): PreviewLine[] {
  const lines: PreviewLine[] = [];
  for (const product of products) {
    const current = policies.get(product.product_id);
    for (const field of Object.keys(POLICY_LABELS) as (keyof StorePolicyChange)[]) {
      const next = change[field];
      if (next === undefined) continue;
      lines.push({
        key: `${product.product_id}:${field}`,
        title: product.product_name,
        detail: POLICY_LABELS[field],
        before: current ? onOff(current[field]) : 'ไม่ทราบค่า',
        after: onOff(next),
      });
    }
  }
  return lines;
}

export function statusPreview(
  products: Product[],
  variantIds: ReadonlySet<string>,
  status: VariantStatusValue,
): PreviewLine[] {
  const lines: PreviewLine[] = [];
  for (const product of products) {
    for (const variant of variantsOf(product)) {
      if (!variant.product_variant_id || !variantIds.has(variant.product_variant_id)) continue;
      lines.push({
        key: variant.product_variant_id,
        title: product.product_name,
        detail: variantLabel(variant),
        before: STATUS_LABELS[variantStatusOf(variant)],
        after: STATUS_LABELS[status],
      });
    }
  }
  return lines;
}

/** Selected products that are still on the page, in page order. */
export function selectedProducts(page: Product[], selected: ReadonlySet<string>): Product[] {
  return page.filter((product) => selected.has(product.product_id));
}
