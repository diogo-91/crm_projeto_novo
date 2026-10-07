import { CommercialQueryProvider } from '@/lib/commercial-query-provider';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedApp } from '@/features/auth/protected-app';
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedApp>
      <CommercialQueryProvider>
        <AppShell>{children}</AppShell>
      </CommercialQueryProvider>
    </ProtectedApp>
  );
}
