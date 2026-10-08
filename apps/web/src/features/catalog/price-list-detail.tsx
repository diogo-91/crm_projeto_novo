'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import type { PriceItemResponse } from '@crm/contracts';
import { Button, Badge, Card, EmptyState, Pagination } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { RecordSummary } from '@/features/commercial/record-summary';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { usePermission } from '@/features/auth/auth-provider';
import { PriceListEditForm } from './price-list-form';
import { PriceForm } from './price-form';
import { CatalogArchive } from './catalog-archive';
import { usePriceList, usePrices } from './queries';
export function PriceListDetail({ id }: { id: string }) {
  const state = useListFilters();
  const query = usePriceList(id);
  const prices = usePrices(id, { cursor: state.filters['cursor'] ?? '', limit: '25' });
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState<PriceItemResponse | 'new' | null>(null);
  const addButton = useRef<HTMLButtonElement | null>(null);
  const read = usePermission('price-lists.read');
  const productsRead = usePermission('products.read');
  if (!read)
    return (
      <EmptyState
        title="Acesso negado"
        description="Você não possui permissão para consultar tabelas de preços."
      />
    );
  if (query.isPending) return <ListSkeleton />;
  if (query.isError)
    return (
      <QueryError
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const row = query.data;
  const manage = row.canManage && row.active;
  return (
    <>
      <PageHeader
        title={row.name}
        description="Tabela de preços"
        breadcrumb={
          <Link
            className="mb-3 inline-block text-body text-muted hover:underline"
            href="/products/price-lists"
          >
            Voltar para tabelas
          </Link>
        }
        actions={
          manage ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setEditing(true)}>Editar tabela</Button>
              <CatalogArchive resource="price-lists" id={id} version={row.version} />
            </div>
          ) : undefined
        }
      />
      <RecordSummary
        notes="Moeda e filial são fixas nesta tabela. Preços arquivados permanecem registrados."
        items={[
          { label: 'Moeda', value: row.currency },
          { label: 'Disponível para', value: row.branch?.name ?? 'Toda a organização' },
          {
            label: 'Status',
            value: (
              <Badge variant={row.active ? 'success' : 'neutral'}>
                {row.active ? 'Ativa' : 'Arquivada'}
              </Badge>
            ),
          },
          { label: 'Versão', value: row.version },
        ]}
      />
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Preços dos produtos</h2>
          {manage && productsRead && (
            <Button ref={addButton} onClick={() => setPrice('new')}>
              Adicionar preço
            </Button>
          )}
        </div>
        <Card>
          {!productsRead ? (
            <EmptyState
              title="Acesso negado"
              description="Leitura de produtos é necessária para consultar preços."
            />
          ) : prices.isPending ? (
            <ListSkeleton />
          ) : prices.isError ? (
            <QueryError
              error={prices.error}
              retry={() => {
                void prices.refetch();
              }}
            />
          ) : !prices.data.data.length ? (
            <EmptyState
              title="Nenhum preço cadastrado"
              description="Adicione um produto e seu preço unitário."
            />
          ) : (
            <ul className="divide-y">
              {prices.data.data.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <Link
                      className="break-words font-semibold hover:underline"
                      href={`/products/${item.product.id}`}
                    >
                      {item.product.name}
                    </Link>
                    <p className="mt-1 break-words text-caption text-muted">
                      {item.product.sku} · {item.product.unit} · {row.currency} {item.unitPrice}
                    </p>
                    <p className="mt-1 text-caption text-muted">
                      {item.active ? 'Preço ativo' : 'Preço arquivado'}
                      {!item.product.active && ' · Produto arquivado'}
                    </p>
                  </div>
                  {manage && (
                    <div className="flex flex-wrap gap-2">
                      {item.product.active && (
                        <Button variant="outline" onClick={() => setPrice(item)}>
                          {item.active ? 'Editar preço' : 'Reativar preço'}
                        </Button>
                      )}
                      {item.active && (
                        <CatalogArchive
                          resource="price-lists"
                          id={id}
                          productId={item.product.id}
                          version={row.version}
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="mt-5">
          <Pagination
            hasNextPage={prices.data?.pageInfo.hasNextPage ?? false}
            hasPreviousPage={state.hasPrevious}
            onNext={() => state.next(prices.data?.pageInfo.nextCursor ?? null)}
            onPrevious={state.previous}
            loading={prices.isFetching}
          />
        </div>
      </section>
      <RecordDialog
        open={editing}
        onOpenChange={setEditing}
        title="Editar tabela"
        description="Apenas o nome pode ser alterado."
      >
        {editing && <PriceListEditForm record={row} onSaved={() => setEditing(false)} />}
      </RecordDialog>
      <RecordDialog
        open={price !== null}
        onOpenChange={(open) => {
          if (!open) setPrice(null);
        }}
        title={price === 'new' ? 'Adicionar preço' : 'Editar preço'}
        description="O preço será aplicado somente a esta tabela."
        fallbackFocus={addButton}
      >
        {price && (
          <PriceForm
            list={row}
            {...(price !== 'new' ? { item: price } : {})}
            onSaved={() => setPrice(null)}
          />
        )}
      </RecordDialog>
    </>
  );
}
