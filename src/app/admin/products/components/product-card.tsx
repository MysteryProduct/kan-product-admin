'use client';

import type { ReactNode } from 'react';
import StatusBadge from '@/components/StatusBadge';
import type { Product } from '@/types/product';
import { getPrimaryVariant, getStockStatus, STOCK_STATUS_LABELS } from './product-stock';

const price = (value: unknown) => {
  const number = value === '' || value === null || value === undefined ? NaN : Number(value);
  return Number.isFinite(number)
    ? `฿${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)}`
    : '-';
};

/** A product on a phone: picture, name, "code · type · colour", then the price and stock badge, and the row's view/edit/⋯ buttons. */
export default function ProductCard({ row, colorHex, onOpen, actions }: { row: Product; colorHex: Map<string, string>; onOpen: () => void; actions?: ReactNode }) {
  const variant = getPrimaryVariant(row);
  const image = row.files?.find((file) => file.product_file_category === 'image');
  const colorName = row.color?.color_name || variant?.color?.color_name;
  const status = getStockStatus(row);
  const hex = colorName ? colorHex.get(colorName) : undefined;
  return (
    <span className="ka-prod ka-prod--card">
      <span className="ka-prod__thumb" aria-hidden="true">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- the API serves uploads outside the image loader
          <img src={`${process.env.NEXT_PUBLIC_API_URL ?? ''}${image.product_file_name}`} alt="" />
        ) : (
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <button type="button" className="ka-prod__name" onClick={onOpen}>
          {row.product_name}
        </button>
        <span className="ka-todo__cap numeric block">
          {[row.product_code, row.category?.category_name, colorName].filter(Boolean).join(' · ')}
          {hex && <i className="ka-swatch ml-1.5" style={{ background: hex }} aria-hidden="true" />}
        </span>
        <span className="ka-prod__foot">
          <span className="numeric font-semibold">{price(row.product_variant_price ?? variant?.product_variant_price)}</span>
          <StatusBadge tone={status === 'in stock' ? 'success' : 'danger'}>{STOCK_STATUS_LABELS[status] ?? '-'}</StatusBadge>
        </span>
        {actions && <span className="ka-prod__acts">{actions}</span>}
      </span>
    </span>
  );
}
