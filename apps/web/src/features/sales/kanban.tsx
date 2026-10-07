'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, EmptyState, Input, FormField, Select } from '@crm/ui';
import type { OpportunityResponse, PipelineResponse, StageResponse } from '@crm/contracts';
import type { Filters } from '@/features/commercial/queries';
import { usePermission } from '@/features/auth/auth-provider';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { AssignmentSelect } from '@/features/commercial/assignment-fields';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { usePipelines, usePipeline, useKanbanColumn } from './queries';
import { PipelineCreateForm, PipelineManager } from './pipeline-manager';
import { MoveForm } from './move-form';
function KanbanColumn({
  pipeline,
  stage,
  filters,
  onMove,
  onDrag,
  onDrop,
  canMove,
}: {
  pipeline: PipelineResponse;
  stage: StageResponse;
  filters: Filters;
  onMove: (record: OpportunityResponse, stageId?: string) => void;
  onDrag: (record: OpportunityResponse | null) => void;
  onDrop: (stage: StageResponse) => void;
  canMove: boolean;
}) {
  const query = useKanbanColumn(pipeline.id, stage.id, filters),
    rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <section
      aria-label={`Etapa ${stage.name}`}
      onDragOver={(event) => {
        if (canMove && stage.active) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (canMove && stage.active) onDrop(stage);
      }}
      className="w-72 shrink-0 rounded-lg border bg-canvas p-3"
    >
      <h2 className="mb-3 font-semibold">
        {stage.name}
        {!stage.active ? ' · inativa' : ''}
      </h2>
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
        <p className="py-6 text-body text-muted">Nenhuma oportunidade nesta etapa.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              draggable={canMove}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', row.id);
                event.dataTransfer.effectAllowed = 'move';
                onDrag(row);
              }}
              onDragEnd={() => onDrag(null)}
            >
              <Card className="space-y-3 p-4">
                <Link className="block font-semibold hover:underline" href={`/crm/${row.id}`}>
                  {row.name}
                </Link>
                <p className="text-body">
                  {row.currency} {row.amount}
                </p>
                <p className="text-caption text-muted">
                  {row.branch.name} · {row.owner.name}
                </p>
                {canMove && (
                  <Button variant="outline" className="w-full" onClick={() => onMove(row)}>
                    Mover {row.name}
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <Button
          variant="link"
          loading={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
          }}
        >
          Mais oportunidades em {stage.name}
        </Button>
      )}
    </section>
  );
}
export function Kanban() {
  const state = useListFilters(),
    list = usePipelines(state.filters['branchId'] ?? '');
  const pipelines = list.data?.pages.flatMap((page) => page.data) ?? [],
    pipelineId = state.filters['pipelineId'] ?? pipelines[0]?.id ?? '',
    query = usePipeline(pipelineId);
  const [creating, setCreating] = useState(false),
    [configuring, setConfiguring] = useState(false),
    [moving, setMoving] = useState<{ record: OpportunityResponse; stageId: string } | null>(null);
  const dragged = useRef<OpportunityResponse | null>(null),
    createButton = useRef<HTMLButtonElement | null>(null);
  const canReadOpportunity = usePermission('opportunities.read');
  const canReadPipeline = usePermission('pipelines.read');
  const canRead = canReadOpportunity && canReadPipeline;
  const canManage = usePermission('pipelines.manage'),
    canMove = usePermission('opportunities.move');
  const filters = {
    search: state.filters['search'] ?? '',
    branchId: state.filters['branchId'] ?? '',
    ownerMembershipId: state.filters['ownerMembershipId'] ?? '',
  };
  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Acompanhe as negociações e mova cada oportunidade com segurança."
        actions={
          canManage ? (
            <Button ref={createButton} onClick={() => setCreating(true)}>
              Novo pipeline
            </Button>
          ) : undefined
        }
      />
      {!canRead ? (
        <EmptyState
          title="Acesso negado"
          description="Você precisa de acesso aos pipelines e às oportunidades."
        />
      ) : (
        <>
          <div className="mb-5 grid gap-4 rounded-lg border bg-surface p-5 sm:grid-cols-2 xl:grid-cols-4">
            <FormField id="board-pipeline" label="Pipeline">
              <Select
                id="board-pipeline"
                label="Pipeline"
                value={pipelineId}
                options={[
                  { value: '', label: 'Selecione um pipeline' },
                  ...pipelines.map((row) => ({ value: row.id, label: row.name })),
                ]}
                onValueChange={(id) => {
                  state.update({ pipelineId: id });
                  setConfiguring(false);
                }}
              />
              {list.hasNextPage && (
                <Button
                  variant="link"
                  onClick={() => {
                    void list.fetchNextPage();
                  }}
                >
                  Mais pipelines
                </Button>
              )}
            </FormField>
            <FormField id="board-search" label="Buscar oportunidades">
              <Input
                id="board-search"
                type="search"
                value={state.search}
                onChange={(event) => state.setSearch(event.target.value)}
              />
            </FormField>
            <AssignmentSelect
              resource="opportunities"
              kind="branches"
              action="read"
              value={filters.branchId}
              label="Filtrar por filial"
              onChange={(branchId) =>
                state.update({ branchId, ownerMembershipId: '', pipelineId: '' })
              }
            />
            <AssignmentSelect
              resource="opportunities"
              kind="owners"
              action="read"
              branchId={filters.branchId}
              value={filters.ownerMembershipId}
              label="Filtrar por responsável"
              onChange={(ownerMembershipId) => state.update({ ownerMembershipId })}
            />
          </div>
          {list.isError ? (
            <QueryError
              error={list.error}
              retry={() => {
                void list.refetch();
              }}
            />
          ) : list.isPending ? (
            <ListSkeleton />
          ) : !pipelineId ? (
            <EmptyState
              title="Nenhum pipeline disponível"
              description="Configure um pipeline para organizar as oportunidades."
            />
          ) : query.isError ? (
            <QueryError
              error={query.error}
              retry={() => {
                void query.refetch();
              }}
            />
          ) : query.isPending ? (
            <ListSkeleton />
          ) : (
            <>
              {!query.data.active && (
                <Alert>
                  Este pipeline foi arquivado. As oportunidades continuam disponíveis para consulta.
                </Alert>
              )}
              <p className="mb-4 text-caption text-muted">
                Arraste um cartão ou use o botão Mover. Cada coluna carrega 25 oportunidades por
                vez.
              </p>
              <div
                className="flex gap-4 overflow-x-auto pb-5"
                role="region"
                aria-label="Quadro de oportunidades"
                tabIndex={0}
              >
                {query.data.stages.map((stage) => (
                  <KanbanColumn
                    key={`${pipelineId}-${stage.id}-${JSON.stringify(filters)}`}
                    pipeline={query.data}
                    stage={stage}
                    filters={filters}
                    canMove={canMove && query.data.active}
                    onDrag={(row) => {
                      dragged.current = row;
                    }}
                    onMove={(record, stageId = '') => setMoving({ record, stageId })}
                    onDrop={(target) => {
                      const record = dragged.current;
                      if (record && target.id !== record.stage.id)
                        setMoving({ record, stageId: target.id });
                      dragged.current = null;
                    }}
                  />
                ))}
              </div>
              {canManage && (
                <Button variant="outline" onClick={() => setConfiguring((value) => !value)}>
                  {configuring ? 'Fechar configuração' : 'Configurar pipeline'}
                </Button>
              )}
              {canManage && configuring && (
                <PipelineManager key={query.data.version} pipeline={query.data} />
              )}
            </>
          )}
        </>
      )}
      <RecordDialog
        open={creating}
        onOpenChange={setCreating}
        title="Novo pipeline"
        fallbackFocus={createButton}
      >
        {creating && <PipelineCreateForm onSaved={() => setCreating(false)} />}
      </RecordDialog>
      <RecordDialog
        open={moving !== null}
        onOpenChange={(open) => {
          if (!open) setMoving(null);
        }}
        title="Mover oportunidade"
      >
        {moving && (
          <MoveForm
            record={moving.record}
            selectedStage={moving.stageId}
            onSaved={() => setMoving(null)}
          />
        )}
      </RecordDialog>
    </>
  );
}
