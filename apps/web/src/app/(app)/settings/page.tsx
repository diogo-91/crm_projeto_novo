import { Can } from '@/features/auth/auth-provider';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/layout/module-placeholder';
import { InterfaceDemo } from '@/components/layout/interface-demo';
export const metadata: Metadata = { title: 'Configurações' };
export default function Page() {
  return (
    <>
      <Can permission="tags.read">
        <Link
          className="mb-6 inline-block text-body font-medium hover:underline"
          href="/settings/tags"
        >
          Gerenciar tags de clientes
        </Link>
      </Can>
      <ModulePlaceholder href="/settings" />
      <InterfaceDemo />
    </>
  );
}
