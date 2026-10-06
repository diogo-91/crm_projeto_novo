import type { ReactNode } from 'react';
export function FilterBar({
  search,
  filters,
  actions,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      role="search"
      aria-label="Busca e filtros"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface p-4"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {search}
        {filters}
      </div>
      {actions}
    </div>
  );
}
