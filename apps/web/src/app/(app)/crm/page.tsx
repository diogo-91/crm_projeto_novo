import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OpportunityList } from '@/features/sales/opportunity-list';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export const metadata: Metadata = { title: 'Oportunidades' };
export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <OpportunityList />
    </Suspense>
  );
}
