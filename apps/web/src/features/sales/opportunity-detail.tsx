'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Badge, EmptyState } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { useOpportunity, useStageHistory } from './queries';
import { MoveForm } from './move-form';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordSummary } from '@/features/commercial/record-summary';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { ArchiveButton } from '@/features/commercial/archive-button';
import { usePermission } from '@/features/auth/auth-provider';
import { OpportunityForm } from './opportunity-form';
import { dealLabels } from './labels';
export function OpportunityDetail({ id }: { id: string }) {
  const query = useOpportunity(id);
  const [editing, setEditing] = useState(false);
  const canRead = usePermission('opportunities.read');
  const canUpdate = usePermission('opportunities.update');
  const history = useStageHistory(id);
  const [moving, setMoving] = useState(false);
  const canMove = usePermission('opportunities.move');
  const canDelete = usePermission('opportunities.delete');
  if (!canRead)
    return (
      <EmptyState
        title="Acesso negado"
        description="Você não possui permissão para consultar oportunidades."
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
        description="Ficha do oportunidade"
        breadcrumb={
          <Link className="mb-3 inline-block text-body text-muted hover:underline" href="/crm">
            Voltar para oportunidades
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canMove && row.active && (
              <Button onClick={() => setMoving(true)}>Mover oportunidade</Button>
            )}
            {canUpdate && row.active && (
              <Button onClick={() => setEditing(true)}>Editar oportunidade</Button>
            )}
            {canDelete && row.active && (
              <ArchiveButton resource="opportunities" id={row.id} version={row.version} />
            )}
          </div>
        }
      />
      <RecordSummary
        notes={row.notes}
        items={[
          { label: 'Pipeline', value: row.pipeline.name },
          { label: 'Etapa', value: row.stage.name },
          { label: 'Resultado', value: dealLabels[row.status] },
          { label: 'Valor', value: row.currency + ' ' + row.amount },
          { label: 'Motivo da perda', value: row.lostReason },
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
      <section className="mt-6 rounded-lg border bg-surface p-5">
        <h2 className="mb-4 text-lg font-semibold">Histórico de etapas</h2>
        {history.isError ? (
          <QueryError
            error={history.error}
            retry={() => {
              void history.refetch();
            }}
          />
        ) : history.isPending ? (
          <ListSkeleton />
        ) : (
          <ol className="space-y-4">
            {history.data.pages
              .flatMap((page) => page.data)
              .map((item) => (
                <li key={item.id} className="border-l-2 pl-4 text-body">
                  {item.from?.name ?? 'Criação'} → {item.to.name} · {dealLabels[item.to.status]}
                  <p className="text-caption text-muted">
                    {new Date(item.occurredAt).toLocaleString('pt-BR')} · versão{' '}
                    {item.recordVersion}
                  </p>
                  {item.reason && <p>{item.reason}</p>}
                </li>
              ))}
          </ol>
        )}
        {history.hasNextPage && (
          <Button
            variant="link"
            onClick={() => {
              void history.fetchNextPage();
            }}
          >
            Mais movimentações
          </Button>
        )}
      </section>
      <RecordDialog open={moving} onOpenChange={setMoving} title="Mover oportunidade">
        {moving && <MoveForm key={row.version} record={row} onSaved={() => setMoving(false)} />}
      </RecordDialog>
      <RecordDialog open={editing} onOpenChange={setEditing} title="Editar oportunidade">
        {editing && (
          <OpportunityForm key={row.version} record={row} onSaved={() => setEditing(false)} />
        )}
      </RecordDialog>
    </>
  );
}
