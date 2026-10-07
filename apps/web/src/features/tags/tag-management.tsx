'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, Pagination, FormField, Input, Select } from '@crm/ui';
import type { TagResponse } from '@crm/contracts';
import { useTags } from '@/features/commercial/queries';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { ArchiveButton } from '@/features/commercial/archive-button';
import { usePermission } from '@/features/auth/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { TagForm } from './tag-form';
export function TagManagement() {
  const state = useListFilters();
  const query = useTags(state.filters);
  const canRead = usePermission('tags.read');
  const canManage = usePermission('tags.manage');
  const [form, setForm] = useState<TagResponse | 'new' | null>(null);
  return (
    <>
      <PageHeader
        title="Tags"
        description="Marcadores compartilhados da organização para classificar clientes."
        breadcrumb={
          <Link className="mb-3 inline-block text-body text-muted hover:underline" href="/settings">
            Voltar para configurações
          </Link>
        }
        actions={canManage ? <Button onClick={() => setForm('new')}>Nova tag</Button> : undefined}
      />
      {!canRead ? (
        <EmptyState
          title="Acesso negado"
          description="Você não possui permissão para consultar tags."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="tag-search" label="Buscar tags">
              <Input
                id="tag-search"
                value={state.search}
                onChange={(event) => state.setSearch(event.target.value)}
              />
            </FormField>
            <FormField id="tag-status" label="Status">
              <Select
                id="tag-status"
                label="Status"
                value={state.filters['active'] ?? ''}
                onValueChange={(value) => state.update({ active: value })}
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'true', label: 'Ativos' },
                  { value: 'false', label: 'Inativos' },
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
            ) : !query.data.data.length ? (
              <EmptyState
                title="Nenhuma tag cadastrada"
                description="Organize os clientes com marcadores consistentes."
              />
            ) : (
              <ul className="divide-y">
                {query.data.data.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-5"
                  >
                    <div>
                      <Badge variant={tag.variant}>{tag.name}</Badge>
                      {!tag.active && <span className="ml-2 text-caption text-muted">Inativa</span>}
                    </div>
                    {canManage && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={() => setForm(tag)}>
                          Editar {tag.name}
                        </Button>
                        {tag.active && (
                          <ArchiveButton resource="tags" id={tag.id} version={tag.version} />
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      <div className="mt-5">
        <Pagination
          hasNextPage={query.data?.pageInfo.hasNextPage ?? false}
          hasPreviousPage={state.hasPrevious}
          onNext={() => state.next(query.data?.pageInfo.nextCursor ?? null)}
          onPrevious={state.previous}
          loading={query.isFetching}
        />
      </div>
      <RecordDialog
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
        title={form === 'new' ? 'Nova tag' : 'Editar tag'}
      >
        {form && (
          <TagForm {...(form === 'new' ? {} : { record: form })} onSaved={() => setForm(null)} />
        )}
      </RecordDialog>
    </>
  );
}
