'use client';
import { ConversionForm } from './conversion-form';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Badge, EmptyState } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { useLead } from './queries';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordSummary } from '@/features/commercial/record-summary';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { ArchiveButton } from '@/features/commercial/archive-button';
import { usePermission } from '@/features/auth/auth-provider';
import { LeadForm } from './lead-form';
import { leadLabels } from './labels';
export function LeadDetail({ id }: { id: string }) {
  const query = useLead(id);
  const [editing, setEditing] = useState(false);
  const canRead = usePermission('leads.read');
  const canUpdate = usePermission('leads.update');
  const [converting, setConverting] = useState(false);
  const canConvert = usePermission('leads.convert');
  const canCreateOpportunity = usePermission('opportunities.create');
  const canReadOpportunity = usePermission('opportunities.read');
  const canReadPipeline = usePermission('pipelines.read');
  const canDelete = usePermission('leads.delete');
  if (!canRead)
    return (
      <EmptyState
        title="Acesso negado"
        description="Você não possui permissão para consultar leads."
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
        description="Ficha do lead"
        breadcrumb={
          <Link className="mb-3 inline-block text-body text-muted hover:underline" href="/leads">
            Voltar para leads
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canConvert &&
              canCreateOpportunity &&
              canReadOpportunity &&
              canReadPipeline &&
              row.active &&
              row.status === 'QUALIFIED' && (
                <Button onClick={() => setConverting(true)}>Converter lead</Button>
              )}
            {canUpdate && row.active && row.status !== 'CONVERTED' && (
              <Button onClick={() => setEditing(true)}>Editar lead</Button>
            )}
            {canDelete && row.active && (
              <ArchiveButton resource="leads" id={row.id} version={row.version} />
            )}
          </div>
        }
      />
      <RecordSummary
        notes={row.notes}
        items={[
          { label: 'Qualificação', value: leadLabels[row.status] },
          { label: 'Empresa prospectada', value: row.companyName },
          {
            label: 'Oportunidade',
            value: row.opportunity ? (
              <Link className="hover:underline" href={`/crm/${row.opportunity.id}`}>
                {row.opportunity.name}
              </Link>
            ) : null,
          },
          { label: 'Telefone', value: row.phone },
          { label: 'E-mail', value: row.email },
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
          {
            label: 'Status',
            value: (
              <Badge variant={row.active ? 'success' : 'neutral'}>
                {row.active ? 'Ativo' : 'Inativo'}
              </Badge>
            ),
          },
          { label: 'Cadastrado em', value: new Date(row.createdAt).toLocaleString('pt-BR') },
          { label: 'Atualizado em', value: new Date(row.updatedAt).toLocaleString('pt-BR') },
        ]}
      />
      <RecordDialog open={converting} onOpenChange={setConverting} title="Converter lead">
        {converting && <ConversionForm record={row} onSaved={() => setConverting(false)} />}
      </RecordDialog>
      <RecordDialog open={editing} onOpenChange={setEditing} title="Editar lead">
        {editing && <LeadForm key={row.version} record={row} onSaved={() => setEditing(false)} />}
      </RecordDialog>
    </>
  );
}
