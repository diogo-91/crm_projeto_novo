'use client';
import { ErrorState, Skeleton } from '@crm/ui';
import { ApiError, errorMessage } from '@/lib/api-client';
export function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
  const title =
    error instanceof ApiError && error.status === 404
      ? 'Registro não encontrado'
      : error instanceof ApiError && error.status === 403
        ? 'Acesso negado'
        : 'Não foi possível carregar';
  return <ErrorState title={title} description={errorMessage(error)} retry={retry} />;
}
export function ListSkeleton() {
  return (
    <div role="status" aria-label="Carregando registros" className="space-y-3 p-6">
      {[0, 1, 2].map((value) => (
        <Skeleton key={value} className="h-14" />
      ))}
    </div>
  );
}
