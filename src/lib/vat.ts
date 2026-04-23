export type VatType = 'none' | 'include' | 'exclude';

export interface VatSummary {
  vatType: VatType;
  subtotal: number;
  vatAmount: number;
  total: number;
}

const VAT_RATE = 0.07;

const toMoney = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
};

export function calculateVatSummary(baseAmount: number, vatType: VatType): VatSummary {
  const amount = Math.max(0, Number(baseAmount || 0));

  if (vatType === 'exclude') {
    const vatAmount = toMoney(amount * VAT_RATE);
    return {
      vatType,
      subtotal: toMoney(amount),
      vatAmount,
      total: toMoney(amount + vatAmount),
    };
  }

  if (vatType === 'include') {
    const vatAmount = toMoney((amount * VAT_RATE) / (1 + VAT_RATE));
    return {
      vatType,
      subtotal: toMoney(amount - vatAmount),
      vatAmount,
      total: toMoney(amount),
    };
  }

  return {
    vatType,
    subtotal: toMoney(amount),
    vatAmount: 0,
    total: toMoney(amount),
  };
}

export const VAT_TYPE_OPTIONS: Array<{ label: string; value: VatType }> = [
  { label: 'ไม่คิด VAT', value: 'none' },
  { label: 'ราคารวม VAT (Include)', value: 'include' },
  { label: 'ราคาไม่รวม VAT (Exclude)', value: 'exclude' },
];

export const VAT_TYPE_LABELS: Record<VatType, string> = {
  none: 'ไม่คิด VAT',
  include: 'รวม VAT',
  exclude: 'แยก VAT',
};
