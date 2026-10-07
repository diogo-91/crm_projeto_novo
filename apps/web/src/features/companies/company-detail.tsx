'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Badge, EmptyState } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { useCompany } from '@/features/commercial/queries';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordSummary } from '@/features/commercial/record-summary';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { ArchiveButton } from '@/features/commercial/archive-button';
import { ContactList } from '@/features/contacts/contact-list';
import { usePermission } from '@/features/auth/auth-provider';
import { CompanyForm } from './company-form';
export function CompanyDetail({ id }: { id: string }) {
  const query = useCompany(id);
  const [editing, setEditing] = useState(false);
  const canRead = usePermission('companies.read');
  const canUpdate = usePermission('companies.update');
  const canDelete = usePermission('companies.delete');
  const canContacts = usePermission('contacts.read');
  if (!canRead)
    return (
      <EmptyState
        title="Acesso negado"
        description="Você não possui permissão para consultar empresas."
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
        description="Ficha da empresa"
        breadcrumb={
          <Link
            className="mb-3 inline-block text-body text-muted hover:underline"
            href="/companies"
          >
            Voltar para empresas
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canUpdate && <Button onClick={() => setEditing(true)}>Editar empresa</Button>}
            {canDelete && row.active && (
              <ArchiveButton resource="companies" id={row.id} version={row.version} />
            )}
          </div>
        }
      />
      <RecordSummary
        notes={row.notes}
        items={[
          { label: 'Razão social', value: row.legalName },
          { label: 'Documento', value: row.document },
          { label: 'Telefone', value: row.phone },
          { label: 'E-mail', value: row.email },
          { label: 'Filial', value: row.branch.name },
          { label: 'Responsável', value: row.owner.name },
          {
            label: 'Status',
            value: (
              <Badge variant={row.active ? 'success' : 'neutral'}>
                {row.active ? 'Ativa' : 'Inativa'}
              </Badge>
            ),
          },
          { label: 'Cadastrada em', value: new Date(row.createdAt).toLocaleString('pt-BR') },
          { label: 'Atualizada em', value: new Date(row.updatedAt).toLocaleString('pt-BR') },
        ]}
      />
      {canContacts && (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Clientes associados</h2>
          <ContactList companyId={row.id} embedded />
        </section>
      )}
      <RecordDialog open={editing} onOpenChange={setEditing} title="Editar empresa">
        {editing && (
          <CompanyForm key={row.version} record={row} onSaved={() => setEditing(false)} />
        )}
      </RecordDialog>
    </>
  );
}
