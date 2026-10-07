import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LeadList } from '@/features/sales/lead-list';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export const metadata: Metadata = { title: 'Leads' };
export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <LeadList />
    </Suspense>
  );
}
