'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Badge, EmptyState } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { useContact } from '@/features/commercial/queries';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordSummary } from '@/features/commercial/record-summary';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { ArchiveButton } from '@/features/commercial/archive-button';
import { usePermission } from '@/features/auth/auth-provider';
import { ContactForm, sourceLabels } from './contact-form';
export function ContactDetail({ id }: { id: string }) {
  const query = useContact(id);
  const [editing, setEditing] = useState(false);
  const canRead = usePermission('contacts.read');
  const canUpdate = usePermission('contacts.update');
  const canDelete = usePermission('contacts.delete');
  if (!canRead)
    return (
      <EmptyState
        title="Acesso negado"
        description="Você não possui permissão para consultar clientes."
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
  return (
    <>
      <PageHeader
        title={row.name}
        description="Ficha do cliente"
        breadcrumb={
          <Link className="mb-3 inline-block text-body text-muted hover:underline" href="/contacts">
            Voltar para clientes
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canUpdate && <Button onClick={() => setEditing(true)}>Editar cliente</Button>}
            {canDelete && row.active && (
              <ArchiveButton resource="contacts" id={row.id} version={row.version} />
            )}
          </div>
        }
      />
      <RecordSummary
        notes={row.notes}
        items={[
          { label: 'Telefone', value: row.phone },
          { label: 'E-mail', value: row.email },
          { label: 'Documento', value: row.document },
          {
            label: 'Empresa',
            value: row.company ? (
              <Link className="hover:underline" href={`/companies/${row.company.id}`}>
                {row.company.name}
              </Link>
            ) : null,
          },
          { label: 'Filial', value: row.branch.name },
          { label: 'Responsável', value: row.owner.name },
          { label: 'Origem', value: sourceLabels[row.source] },
          {
            label: 'Status',
            value: (
              <Badge variant={row.active ? 'success' : 'neutral'}>
                {row.active ? 'Ativo' : 'Inativo'}
              </Badge>
            ),
          },
          {
            label: 'Tags',
            value: (
              <div className="flex flex-wrap gap-1">
                {row.tags.map((tag) => (
                  <Badge key={tag.id} variant={tag.variant}>
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ),
          },
          { label: 'Cadastrado em', value: new Date(row.createdAt).toLocaleString('pt-BR') },
          { label: 'Atualizado em', value: new Date(row.updatedAt).toLocaleString('pt-BR') },
        ]}
      />
      <RecordDialog open={editing} onOpenChange={setEditing} title="Editar cliente">
        {editing && (
          <ContactForm key={row.version} record={row} onSaved={() => setEditing(false)} />
        )}
      </RecordDialog>
    </>
  );
}
