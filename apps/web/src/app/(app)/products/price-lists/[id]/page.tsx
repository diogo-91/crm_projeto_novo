import { Suspense } from 'react';
import { PriceListDetail } from '@/features/catalog/price-list-detail';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PriceListDetail id={id} />
    </Suspense>
  );
}
