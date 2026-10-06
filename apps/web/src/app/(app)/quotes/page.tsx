import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/layout/module-placeholder';
export const metadata: Metadata = { title: 'Orçamentos' };
export default function Page() {
  return (
    <>
      <ModulePlaceholder href="/quotes" />
    </>
  );
}
