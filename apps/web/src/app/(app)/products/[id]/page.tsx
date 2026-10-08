import { Suspense } from 'react';
import { ProductDetail } from '@/features/catalog/product-detail';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ProductDetail id={id} />
    </Suspense>
  );
}
