import { Suspense } from 'react';
import { PriceListList } from '@/features/catalog/price-list-list';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PriceListList />
    </Suspense>
  );
}
