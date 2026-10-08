import { Suspense } from 'react';
import { QuoteList } from '@/features/quotes/quote-list';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export const metadata = { title: 'Orçamentos — CRM' };
export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <QuoteList />
    </Suspense>
  );
}
