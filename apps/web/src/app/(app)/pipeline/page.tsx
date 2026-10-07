import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Kanban } from '@/features/sales/kanban';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export const metadata: Metadata = { title: 'Pipeline' };
export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Kanban />
    </Suspense>
  );
}
