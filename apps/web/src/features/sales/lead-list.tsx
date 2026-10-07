'use client';
import { leadLabels } from './labels';
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
import { useLeads } from './queries';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { ListToolbar } from '@/features/commercial/list-toolbar';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { usePermission } from '@/features/auth/auth-provider';
import { LeadForm } from './lead-form';
export function LeadList() {
  const state = useListFilters();
  const query = useLeads(state.filters);
  const [creating, setCreating] = useState(false);
  const createButton = useRef<HTMLButtonElement | null>(null);
  const canCreate = usePermission('leads.create');
  const canRead = usePermission('leads.read');
  const rows = query.data?.data ?? [];
  return (
    <>
      <PageHeader
        title="Leads"
        description="Qualifique os interesses da sua carteira e converta em oportunidades."
        actions={
          canCreate ? (
            <Button ref={createButton} onClick={() => setCreating(true)}>
              Novo lead
            </Button>
          ) : undefined
        }
      />
      {!canRead ? (
        <EmptyState
          title="Acesso negado"
          description="Você não possui permissão para consultar leads."
        />
      ) : (
        <>
          <ListToolbar
            resource="leads"
            filters={state.filters}
            search={state.search}
            onSearch={state.setSearch}
            onFilter={state.update}
          />
          <div className="mb-5 max-w-sm">
            <FormField id="leads-outcome" label="Qualificação">
              <Select
                id="leads-outcome"
                label="Qualificação"
                value={state.filters['status'] ?? ''}
                options={[
                  { value: '', label: 'Todos' },
                  ...Object.entries(leadLabels).map(([value, label]) => ({ value, label })),
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
                title="Nenhum lead encontrado"
                description="Cadastre o primeiro lead ou ajuste os filtros."
                action={
                  canCreate ? (
                    <Button onClick={() => setCreating(true)}>Cadastrar primeiro lead</Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Lead', 'Qualificação', 'Contato', 'Filial / responsável', 'Status'].map(
                          (label) => (
                            <TableHead key={label}>{label}</TableHead>
                          ),
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link className="font-medium hover:underline" href={`/leads/${row.id}`}>
                              {row.name}
                            </Link>
                            <p className="text-caption text-muted">{row.companyName}</p>
                          </TableCell>
                          <TableCell>{leadLabels[row.status]}</TableCell>
                          <TableCell>
                            {row.phone ?? '—'}
                            <p className="text-caption text-muted">{row.email}</p>
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
                      <Link className="font-semibold hover:underline" href={`/leads/${row.id}`}>
                        {row.name}
                      </Link>
                      <p className="text-body">
                        {leadLabels[row.status] ?? 'Documento não informado'}
                      </p>
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
        title="Novo lead"
        fallbackFocus={createButton}
      >
        {creating && <LeadForm onSaved={() => setCreating(false)} />}
      </RecordDialog>
    </>
  );
}
