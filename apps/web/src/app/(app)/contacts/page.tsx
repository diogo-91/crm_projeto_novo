import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ContactList } from '@/features/contacts/contact-list';
import { ListSkeleton } from '@/features/commercial/query-feedback';
export const metadata: Metadata = { title: 'Clientes' };
export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ContactList />
    </Suspense>
  );
}
