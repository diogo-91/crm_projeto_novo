import { Suspense } from 'react';
import { CompanyDetail } from '@/features/companies/company-detail';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ListSkeleton />}>
      <CompanyDetail id={id} />
    </Suspense>
  );
}
