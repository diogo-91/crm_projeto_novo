'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button, Card, EmptyState, Pagination, Badge } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { usePermission } from '@/features/auth/auth-provider';
import { useProducts } from './queries';
import { ProductForm } from './product-form';
import { CatalogLinks, CatalogToolbar } from './catalog-toolbar';
export function ProductList() {
  const state = useListFilters();
  const query = useProducts(state.filters);
  const [creating, setCreating] = useState(false);
  const createButton = useRef<HTMLButtonElement | null>(null);
  const canRead = usePermission('products.read');
  const canManage = usePermission('products.manage');
  const rows = query.data?.data ?? [];
  return (
    <>
      <PageHeader
        title="Produtos"
        description="Catálogo e preços organizados para sua equipe."
        actions={
          canManage ? (
            <Button ref={createButton} onClick={() => setCreating(true)}>
              Novo produto
            </Button>
          ) : undefined
        }
      />
      <CatalogLinks />
      {!canRead ? (
        <EmptyState
          title="Acesso negado"
          description="Você não possui permissão para consultar este catálogo."
        />
      ) : (
        <>
          <CatalogToolbar
            filters={state.filters}
            search={state.search}
            onSearch={state.setSearch}
            onFilter={state.update}
          />
          <Card>
            {query.isPending ? (
              <ListSkeleton />
            ) : query.isError ? (
              <QueryError
                error={query.error}
                retry={() => {
                  void query.refetch();
                }}
              />
            ) : !rows.length ? (
              <EmptyState
                title="Nenhum registro encontrado"
                description="Cadastre o primeiro registro ou ajuste os filtros."
              />
            ) : (
              <ul className="divide-y">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-5"
                  >
                    <div className="min-w-0">
                      <Link
                        className="break-words font-semibold hover:underline"
                        href={`/products/${row.id}`}
                      >
                        {row.name}
                      </Link>
                      <p className="mt-1 break-words text-caption text-muted">
                        {row.sku} · {row.unit}
                      </p>
                    </div>
                    <Badge variant={row.active ? 'success' : 'neutral'}>
                      {row.active ? 'Ativo' : 'Arquivado'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="mt-5">
            <Pagination
              hasNextPage={query.data?.pageInfo.hasNextPage ?? false}
              hasPreviousPage={state.hasPrevious}
              onNext={() => state.next(query.data?.pageInfo.nextCursor ?? null)}
              onPrevious={state.previous}
              loading={query.isFetching}
            />
          </div>
        </>
      )}
      <RecordDialog
        open={creating}
        onOpenChange={setCreating}
        title="Novo produto"
        description="Confira os dados do catálogo antes de salvar."
        fallbackFocus={createButton}
      >
        {creating && <ProductForm onSaved={() => setCreating(false)} />}
      </RecordDialog>
    </>
  );
}
