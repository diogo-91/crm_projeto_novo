import { Suspense } from 'react';
import { OpportunityDetail } from '@/features/sales/opportunity-detail';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ListSkeleton />}>
      <OpportunityDetail id={id} />
    </Suspense>
  );
}
