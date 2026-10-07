import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CompanyList } from '@/features/companies/company-list';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export const metadata: Metadata = { title: 'Empresas' };
export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <CompanyList />
    </Suspense>
  );
}
