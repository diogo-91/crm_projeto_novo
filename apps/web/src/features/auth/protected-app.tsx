'use client';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState, Card, Button } from '@crm/ui';
import { useAuth } from './auth-provider';
import { errorMessage } from '@/lib/api-client';
import { PageSkeleton } from '@/components/feedback/page-skeleton';
import { OrganizationSwitcher } from './organization-switcher';
export function ProtectedApp({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status === 'anonymous') router.replace('/login');
  }, [state.status, router]);
  if (state.status === 'error')
    return (
      <main className="mx-auto max-w-lg p-6">
        <Card>
          <ErrorState headingLevel={1} description={errorMessage(state.error)} />
          <div className="flex justify-center pb-6">
            <Button onClick={() => router.replace('/login')}>Voltar para o login</Button>
          </div>
        </Card>
      </main>
    );
  if (state.status !== 'authenticated') return <PageSkeleton />;
  if (!state.me.context)
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center p-6">
        <Card className="w-full p-6">
          <h1 className="text-xl font-semibold">Seu espaço de trabalho</h1>
          <p className="mb-6 mt-2 text-body text-muted">
            {state.me.memberships.length
              ? 'Selecione uma organização para continuar.'
              : 'Você ainda não possui vínculo ativo com uma organização. Entre em contato com o administrador.'}
          </p>
          <OrganizationSwitcher showLogout />
        </Card>
      </main>
    );
  return children;
}
