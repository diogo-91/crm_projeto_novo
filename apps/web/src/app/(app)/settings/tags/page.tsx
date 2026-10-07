import { Suspense } from 'react';
import { TagManagement } from '@/features/tags/tag-management';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <TagManagement />
    </Suspense>
  );
}
