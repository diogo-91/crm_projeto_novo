'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Badge,
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
  Select,
  FormField,
} from '@crm/ui';
import { useContacts, useTagChoices } from '@/features/commercial/queries';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { ListToolbar } from '@/features/commercial/list-toolbar';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { CompanyPicker } from '@/features/commercial/company-picker';
import { PageHeader } from '@/components/layout/page-header';
import { usePermission } from '@/features/auth/auth-provider';
import { ContactForm, sourceLabels } from './contact-form';
import { contactSources } from '@crm/contracts';
export function ContactList({
  companyId,
  embedded = false,
}: {
  companyId?: string;
  embedded?: boolean;
}) {
  const state = useListFilters();
  const filters = companyId ? { ...state.filters, companyId } : state.filters;
  const query = useContacts(filters);
  const tags = useTagChoices();
  const [creating, setCreating] = useState(false);
  const createButton = useRef<HTMLButtonElement | null>(null);
  const canCreate = usePermission('contacts.create');
  const canRead = usePermission('contacts.read');
  const canCompany = usePermission('companies.read');
  const canTags = usePermission('tags.read');
  const rows = query.data?.data ?? [];
  return (
    <section>
      {!embedded && (
        <PageHeader
          title="Clientes"
          description="Pessoas, empresas e relacionamentos da sua carteira."
          actions={
            canCreate ? (
              <Button ref={createButton} onClick={() => setCreating(true)}>
                Novo cliente
              </Button>
            ) : undefined
          }
        />
      )}
      {!canRead ? (
        <EmptyState
          title="Acesso negado"
          description="Você não possui permissão para consultar clientes."
        />
      ) : (
        <>
          {!embedded && (
            <>
              <ListToolbar
                resource="contacts"
                filters={state.filters}
                search={state.search}
                onSearch={state.setSearch}
                onFilter={state.update}
              />
              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {canCompany && (
                  <CompanyPicker
                    emptyLabel="Todas as empresas"
                    value={state.filters['companyId'] ?? ''}
                    onChange={(value) => state.update({ companyId: value })}
                  />
                )}
                {canTags && (
                  <FormField id="contacts-tag" label="Filtrar por tag">
                    <Select
                      id="contacts-tag"
                      label="Filtrar por tag"
                      value={state.filters['tagId'] ?? ''}
                      options={[
                        { value: '', label: 'Todas' },
                        ...(tags.data?.pages.flatMap((page) => page.data) ?? []).map((tag) => ({
                          value: tag.id,
                          label: tag.name,
                        })),
                      ]}
                      onValueChange={(value) => state.update({ tagId: value })}
                    />
                    {tags.hasNextPage && (
                      <Button
                        variant="link"
                        onClick={() => {
                          void tags.fetchNextPage();
                        }}
                      >
                        Carregar mais tags
                      </Button>
                    )}
                  </FormField>
                )}
                <FormField id="contacts-source" label="Origem">
                  <Select
                    id="contacts-source"
                    label="Origem"
                    value={state.filters['source'] ?? ''}
                    options={[
                      { value: '', label: 'Todas' },
                      ...contactSources.map((source) => ({
                        value: source,
                        label: sourceLabels[source],
                      })),
                    ]}
                    onValueChange={(value) => state.update({ source: value })}
                  />
                </FormField>
              </div>
            </>
          )}
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
                title="Nenhum cliente encontrado"
                description="Cadastre o primeiro cliente ou ajuste os filtros."
                action={
                  !embedded && canCreate ? (
                    <Button onClick={() => setCreating(true)}>Cadastrar primeiro cliente</Button>
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
                          'Cliente',
                          'Telefone',
                          'Empresa',
                          'Filial / responsável',
                          'Tags / origem',
                          'Atualizado',
                        ].map((label) => (
                          <TableHead key={label}>{label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link
                              className="font-medium hover:underline"
                              href={`/contacts/${row.id}`}
                            >
                              {row.name}
                            </Link>
                            <div>
                              <Badge variant={row.active ? 'success' : 'neutral'}>
                                {row.active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>{row.phone}</TableCell>
                          <TableCell>{row.company?.name ?? '—'}</TableCell>
                          <TableCell>
                            {row.branch.name}
                            <p className="text-caption text-muted">{row.owner.name}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.tags.map((tag) => (
                                <Badge key={tag.id} variant={tag.variant}>
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                            <p className="mt-2 text-caption text-muted">
                              {sourceLabels[row.source]}
                            </p>
                          </TableCell>
                          <TableCell>
                            <time dateTime={row.updatedAt}>
                              {new Date(row.updatedAt).toLocaleDateString('pt-BR')}
                            </time>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="divide-y md:hidden">
                  {rows.map((row) => (
                    <li key={row.id} className="space-y-2 p-5">
                      <Link className="font-semibold hover:underline" href={`/contacts/${row.id}`}>
                        {row.name}
                      </Link>
                      <p className="text-body">{row.phone}</p>
                      <p className="text-caption text-muted">
                        {row.branch.name} · {row.owner.name}
                      </p>
                      {row.company && <p className="text-body">{row.company.name}</p>}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={row.active ? 'success' : 'neutral'}>
                          {row.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        {row.tags.map((tag) => (
                          <Badge key={tag.id} variant={tag.variant}>
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
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
        title="Novo cliente"
        fallbackFocus={createButton}
      >
        {creating && <ContactForm onSaved={() => setCreating(false)} />}
      </RecordDialog>
    </section>
  );
}
