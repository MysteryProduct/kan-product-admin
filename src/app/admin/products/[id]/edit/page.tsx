'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import ProductEditor from '../../components/product-editor';
import LoadErrorBanner, { loadErrorText } from '@/components/LoadErrorBanner';
import ProductModel, { type StorePolicyState } from '@/models/product';
import type { Product } from '@/types/product';

const productModel = new ProductModel();

/** Reads the product and its store switches, then hands both to the editor. */
export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [state, setState] = useState<{ product: Product; policy?: Omit<StorePolicyState, 'product_id'> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setError(null);
    Promise.all([productModel.getProductById(id), productModel.getStorePolicies([id]).catch(() => [])])
      .then(([product, policies]) => {
        if (!active) return;
        const policy = policies.find((item) => item.product_id === id);
        setState({ product, policy: policy ? { published: policy.published, online_purchase: policy.online_purchase, contact_enabled: policy.contact_enabled } : undefined });
      })
      .catch((failure: unknown) => {
        if (active) setError(loadErrorText('สินค้า', failure));
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  if (error) {
    return (
      <div className="ka-page-body">
        <LoadErrorBanner message={error} onRetry={() => setAttempt((count) => count + 1)} />
      </div>
    );
  }
  if (!state) {
    return (
      <div className="ka-page-body" aria-busy="true">
        <span className="ka-skel ka-skel--title" />
        <p className="sr-only">กำลังโหลดสินค้า</p>
      </div>
    );
  }
  return <ProductEditor key={state.product.product_id} mode="edit" product={state.product} policy={state.policy} />;
}
