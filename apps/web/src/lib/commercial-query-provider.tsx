'use client';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
function ScopedQueries({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 0, gcTime: 300000 },
          mutations: { retry: false },
        },
      }),
  );
  useEffect(
    () => () => {
      void client.cancelQueries();
      client.clear();
    },
    [client],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export function CommercialQueryProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status !== 'authenticated' || !state.me.context) return null;
  const scope = JSON.stringify([
    state.me.user.id,
    state.me.context.organizationId,
    state.me.context.membershipId,
    state.me.context.cacheScopeKey,
  ]);
  return <ScopedQueries key={scope}>{children}</ScopedQueries>;
}
