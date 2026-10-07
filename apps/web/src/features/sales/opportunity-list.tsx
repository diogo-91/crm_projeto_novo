'use client';
import { dealLabels } from './labels';
import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  EmptyState,
  Pagination,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  FormField,
  Select,
} from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { useOpportunities } from './queries';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { ListToolbar } from '@/features/commercial/list-toolbar';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { usePermission } from '@/features/auth/auth-provider';
import { OpportunityForm } from './opportunity-form';
export function OpportunityList() {
  const state = useListFilters();
  const query = useOpportunities(state.filters);
  const [creating, setCreating] = useState(false);
  const createButton = useRef<HTMLButtonElement | null>(null);
  const canCreate = usePermission('opportunities.create');
  const canRead = usePermission('opportunities.read');
  const rows = query.data?.data ?? [];
  return (
    <>
      <PageHeader
        title="Oportunidades"
        description="Negociações organizadas por etapa, filial e responsável."
        actions={
          canCreate ? (
            <Button ref={createButton} onClick={() => setCreating(true)}>
              Nova oportunidade
            </Button>
          ) : undefined
        }
      />
      {!canRead ? (
        <EmptyState
          title="Acesso negado"
          description="Você não possui permissão para consultar oportunidades."
        />
      ) : (
        <>
          <ListToolbar
            resource="opportunities"
            filters={state.filters}
            search={state.search}
            onSearch={state.setSearch}
            onFilter={state.update}
          />
          <div className="mb-5 max-w-sm">
            <FormField id="opportunities-outcome" label="Resultado">
              <Select
                id="opportunities-outcome"
                label="Resultado"
                value={state.filters['status'] ?? ''}
                options={[
                  { value: '', label: 'Todos' },
                  ...Object.entries(dealLabels).map(([value, label]) => ({ value, label })),
                ]}
                onValueChange={(status) => state.update({ status })}
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
                title="Nenhuma oportunidade encontrada"
                description="Cadastre a primeira oportunidade ou ajuste os filtros."
                action={
                  canCreate ? (
                    <Button onClick={() => setCreating(true)}>
                      Cadastrar primeira oportunidade
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          'Oportunidade',
                          'Etapa / resultado',
                          'Valor',
                          'Filial / responsável',
                          'Status',
                        ].map((label) => (
                          <TableHead key={label}>{label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link className="font-medium hover:underline" href={`/crm/${row.id}`}>
                              {row.name}
                            </Link>
                            <p className="text-caption text-muted">{row.pipeline.name}</p>
                          </TableCell>
                          <TableCell>
                            {row.stage.name} · {dealLabels[row.status]}
                          </TableCell>
                          <TableCell>
                            {row.currency} {row.amount}
                            <p className="text-caption text-muted">
                              {row.contact?.name ?? row.company?.name}
                            </p>
                          </TableCell>
                          <TableCell>
                            {row.branch.name}
                            <p className="text-caption text-muted">{row.owner.name}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.active ? 'success' : 'neutral'}>
                              {row.active ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="divide-y md:hidden">
                  {rows.map((row) => (
                    <li key={row.id} className="space-y-2 p-5">
                      <Link className="font-semibold hover:underline" href={`/crm/${row.id}`}>
                        {row.name}
                      </Link>
                      <p className="text-body">{row.stage.name}</p>
                      <p className="text-caption text-muted">
                        {row.branch.name} · {row.owner.name}
                      </p>
                      <Badge variant={row.active ? 'success' : 'neutral'}>
                        {row.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </>
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
        title="Nova oportunidade"
        fallbackFocus={createButton}
      >
        {creating && <OpportunityForm onSaved={() => setCreating(false)} />}
      </RecordDialog>
    </>
  );
}
