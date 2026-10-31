'use client';

import ProductEditor from '../components/product-editor';
import NoPermissionNote from '../components/no-permission-note';
import { usePermissions } from '@/hooks/usePermissions';

export default function NewProductPage() {
  const { can } = usePermissions();
  if (!can('products', 'add')) return <NoPermissionNote action="เพิ่มสินค้า" />;
  return <ProductEditor mode="create" />;
}
