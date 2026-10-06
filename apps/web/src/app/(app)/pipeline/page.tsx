import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/layout/module-placeholder';
export const metadata: Metadata = { title: 'Pipeline' };
export default function Page() {
  return (
    <>
      <ModulePlaceholder href="/pipeline" />
    </>
  );
}
