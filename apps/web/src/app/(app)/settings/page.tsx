import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/layout/module-placeholder';
import { InterfaceDemo } from '@/components/layout/interface-demo';
export const metadata: Metadata = { title: 'Configurações' };
export default function Page() {
  return (
    <>
      <ModulePlaceholder href="/settings" />
      <InterfaceDemo />
    </>
  );
}
