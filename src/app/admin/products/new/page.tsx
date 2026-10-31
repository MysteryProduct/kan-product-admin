'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductEditor from '../components/product-editor';
import NoPermissionNote from '../components/no-permission-note';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import { usePermissions } from '@/hooks/usePermissions';
import ProductModel from '@/models/product';
import type { Product } from '@/types/product';

const productModel = new ProductModel();

/**
 * "ทำสำเนา" from the product list opens this page with `?copy=<id>`: the form starts from that
 * product as a new one. Variant ids, the code and pictures stay with the original.
 */
function asCopy(product: Product): Product {
  const variants = (product.product_variants || product.productVariants || []).map((variant) => ({
    ...variant,
    product_variant_id: '',
  }));
  return {
    ...product,
    product_name: `${product.product_name} (สำเนา)`,
    product_code: undefined,
    files: [],
    product_variants: variants,
    productVariants: undefined,
  } as Product;
}

function NewProduct() {
  const copyId = useSearchParams()?.get('copy');
  const [source, setSource] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!copyId) return;
    let active = true;
    productModel
      .getProductById(copyId)
      .then((product) => active && setSource(asCopy(product)))
      .catch((failure: unknown) => active && setError(loadErrorText('สินค้าต้นฉบับ', failure)));
    return () => {
      active = false;
    };
  }, [copyId, attempt]);

  if (!copyId) return <ProductEditor mode="create" />;
  if (error) {
    return (
      <div className="ka-page-body">
        <LoadErrorBanner message={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} />
      </div>
    );
  }
  if (!source) {
    return (
      <div className="ka-page-body" aria-busy="true">
        <span className="ka-skel ka-skel--title" />
        <p className="sr-only">กำลังโหลดสินค้าต้นฉบับ</p>
      </div>
    );
  }
  return <ProductEditor key={copyId} mode="create" product={source} />;
}

export default function NewProductPage() {
  const { can } = usePermissions();
  if (!can('products', 'add')) return <NoPermissionNote action="เพิ่มสินค้า" />;
  return (
    <Suspense fallback={null}>
      <NewProduct />
    </Suspense>
  );
}
