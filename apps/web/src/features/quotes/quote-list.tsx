'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, EmptyState, Pagination, Badge, FormField, Input, Select } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { usePermission } from '@/features/auth/auth-provider';
import { useOpportunity } from '@/features/sales/queries';
import { useQuotes } from './queries';
import { QuoteForm } from './quote-form';
export function QuoteList() {
  const state = useListFilters(),
    query = useQuotes(state.filters),
    router = useRouter();
  const opportunity = useOpportunity(state.filters['opportunityId'] ?? '');
  const [creating, setCreating] = useState(false),
    createButton = useRef<HTMLButtonElement | null>(null);
  const canRead = usePermission('quotes.read'),
    canCreate = usePermission('quotes.create');
  const rows = query.data?.data ?? [];
  return (
    <>
      <PageHeader
        title="Orçamentos"
        description="Propostas com preços preservados, revisão e aprovação."
        actions={
          canCreate ? (
            <Button
              ref={createButton}
              disabled={Boolean(state.filters['opportunityId']) && !opportunity.data}
              onClick={() => setCreating(true)}
            >
              Novo orçamento
            </Button>
          ) : undefined
        }
      />
      {state.filters['opportunityId'] && (
        <div className="mb-5">
          {opportunity.isError ? (
            <QueryError
              error={opportunity.error}
              retry={() => {
                void opportunity.refetch();
              }}
            />
          ) : (
            <p className="text-body">Oportunidade: {opportunity.data?.name ?? 'Carregando…'}</p>
          )}
          <Link className="text-body underline" href="/quotes">
            Todos os orçamentos
          </Link>
        </div>
      )}
      {!canRead ? (
        <EmptyState
          title="Acesso negado"
          description="Você não possui permissão para consultar orçamentos."
        />
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <FormField id="quotes-search" label="Buscar orçamento">
              <Input
                id="quotes-search"
                value={state.search}
                onChange={(event) => state.setSearch(event.target.value)}
              />
            </FormField>
            <FormField id="quotes-status" label="Status">
              <Select
                id="quotes-status"
                label="Status"
                value={state.filters['status'] ?? ''}
                onValueChange={(status) => state.update({ status })}
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'DRAFT', label: 'Rascunho' },
                  { value: 'APPROVED', label: 'Aprovado' },
                ]}
              />
            </FormField>
          </div>
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
                title="Nenhum orçamento encontrado"
                description="Crie uma proposta ou ajuste os filtros."
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
                        href={`/quotes/${row.id}`}
                      >
                        {row.name}
                      </Link>
                      <p className="mt-1 text-caption text-muted">
                        Revisão {row.revision} · {row.currency} {row.total}
                      </p>
                    </div>
                    <Badge variant={row.status === 'APPROVED' ? 'success' : 'neutral'}>
                      {row.status === 'APPROVED' ? 'Aprovado' : 'Rascunho'}
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
        title="Novo orçamento"
        description="Selecione comprador e preços. A aprovação preservará esta proposta."
        fallbackFocus={createButton}
      >
        {creating && (
          <QuoteForm
            {...(opportunity.data ? { opportunity: opportunity.data } : {})}
            onSaved={(row) => {
              setCreating(false);
              router.push(`/quotes/${row.id}`);
            }}
          />
        )}
      </RecordDialog>
    </>
  );
}
