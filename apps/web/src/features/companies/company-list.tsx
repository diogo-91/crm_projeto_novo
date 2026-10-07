'use client';
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
} from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { useCompanies } from '@/features/commercial/queries';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { ListToolbar } from '@/features/commercial/list-toolbar';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { usePermission } from '@/features/auth/auth-provider';
import { CompanyForm } from './company-form';
export function CompanyList() {
  const state = useListFilters();
  const query = useCompanies(state.filters);
  const [creating, setCreating] = useState(false);
  const createButton = useRef<HTMLButtonElement | null>(null);
  const canCreate = usePermission('companies.create');
  const canRead = usePermission('companies.read');
  const rows = query.data?.data ?? [];
  return (
    <>
      <PageHeader
        title="Empresas"
        description="Relacionamentos B2B organizados por filial e responsável."
        actions={
          canCreate ? (
            <Button ref={createButton} onClick={() => setCreating(true)}>
              Nova empresa
            </Button>
          ) : undefined
        }
      />
      {!canRead ? (
        <EmptyState
          title="Acesso negado"
          description="Você não possui permissão para consultar empresas."
        />
      ) : (
        <>
          <ListToolbar
            resource="companies"
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
                title="Nenhuma empresa encontrada"
                description="Cadastre a primeira empresa ou ajuste os filtros."
                action={
                  canCreate ? (
                    <Button onClick={() => setCreating(true)}>Cadastrar primeira empresa</Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Empresa', 'Documento', 'Contato', 'Filial / responsável', 'Status'].map(
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
                            <Link
                              className="font-medium hover:underline"
                              href={`/companies/${row.id}`}
                            >
                              {row.name}
                            </Link>
                            <p className="text-caption text-muted">{row.legalName}</p>
                          </TableCell>
                          <TableCell>{row.document ?? '—'}</TableCell>
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
                      <Link className="font-semibold hover:underline" href={`/companies/${row.id}`}>
                        {row.name}
                      </Link>
                      <p className="text-body">{row.document ?? 'Documento não informado'}</p>
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
        title="Nova empresa"
        fallbackFocus={createButton}
      >
        {creating && <CompanyForm onSaved={() => setCreating(false)} />}
      </RecordDialog>
    </>
  );
}
