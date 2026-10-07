import { Suspense } from 'react';
import { LeadDetail } from '@/features/sales/lead-detail';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ListSkeleton />}>
      <LeadDetail id={id} />
    </Suspense>
  );
}
