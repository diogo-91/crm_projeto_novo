'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button, Card, EmptyState, Pagination, FormField, Select, Badge } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { useListFilters } from '@/features/commercial/use-list-filters';
import { ListToolbar } from '@/features/commercial/list-toolbar';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { usePermission } from '@/features/auth/auth-provider';
import { useTasks } from './queries';
import { TaskForm } from './task-form';
import { taskLabels, priorityLabels, localDayInterval } from './dates';
export function TaskList() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const state = useListFilters();
  const query = useTasks(state.filters);
  const [creating, setCreating] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const read = usePermission('tasks.read'),
    create = usePermission('tasks.create');
  const rows = query.data?.data ?? [];
  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Organize compromissos e follow-ups da sua carteira."
        actions={
          create ? (
            <Button ref={button} onClick={() => setCreating(true)}>
              Nova tarefa
            </Button>
          ) : undefined
        }
      />
      {!read ? (
        <EmptyState
          title="Acesso negado"
          description="Você não possui permissão para consultar tarefas."
        />
      ) : (
        <>
          <ListToolbar
            resource="tasks"
            filters={state.filters}
            search={state.search}
            onSearch={state.setSearch}
            onFilter={state.update}
          />
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <FormField id="tasks-status" label="Situação">
              <Select
                id="tasks-status"
                label="Situação"
                value={state.filters['status'] ?? ''}
                options={[
                  { value: '', label: 'Todas' },
                  { value: 'OPEN', label: 'Pendentes' },
                  { value: 'COMPLETED', label: 'Concluídas' },
                ]}
                onValueChange={(status) => state.update({ status })}
              />
            </FormField>
            <FormField id="tasks-kind-filter" label="Finalidade">
              <Select
                id="tasks-kind-filter"
                label="Finalidade"
                value={state.filters['kind'] ?? ''}
                options={[
                  { value: '', label: 'Todas' },
                  ...Object.entries(taskLabels).map(([value, label]) => ({ value, label })),
                ]}
                onValueChange={(kind) => state.update({ kind })}
              />
            </FormField>
            <FormField id="tasks-due-filter" label="Prazo">
              <Select
                id="tasks-due-filter"
                label="Prazo"
                value={state.filters['from'] ? 'today' : (state.filters['due'] ?? '')}
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'overdue', label: 'Vencidas' },
                  { value: 'today', label: 'Hoje' },
                  { value: 'upcoming', label: 'Próximas' },
                ]}
                onValueChange={(value) =>
                  state.update(
                    value === 'today'
                      ? { due: '', ...localDayInterval() }
                      : { due: value, from: '', until: '' },
                  )
                }
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
                title="Nenhuma tarefa encontrada"
                description="Cadastre uma tarefa ou ajuste os filtros."
              />
            ) : (
              <>
                <ul className="divide-y">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-5"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          className="break-words font-semibold text-foreground underline-offset-4 hover:underline"
                          href={`/tasks/${row.id}`}
                        >
                          {row.name}
                        </Link>
                        <p className="mt-1 text-caption text-muted">
                          {taskLabels[row.kind]} · {row.branch.name} · {row.owner.name}
                        </p>
                        <p className="mt-1 text-body">
                          {row.dueAt
                            ? new Date(row.dueAt).toLocaleString('pt-BR')
                            : 'Sem vencimento'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={row.priority === 'HIGH' ? 'warning' : 'neutral'}>
                          {priorityLabels[row.priority]}
                        </Badge>
                        <Badge
                          variant={
                            row.status === 'COMPLETED'
                              ? 'success'
                              : row.dueAt && Date.parse(row.dueAt) < now
                                ? 'danger'
                                : 'neutral'
                          }
                        >
                          {!row.active
                            ? 'Arquivada'
                            : row.status === 'COMPLETED'
                              ? 'Concluída'
                              : row.dueAt && Date.parse(row.dueAt) < now
                                ? 'Vencida'
                                : 'Pendente'}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination
                  hasPreviousPage={state.hasPrevious}
                  hasNextPage={query.data?.pageInfo.hasNextPage ?? false}
                  onPrevious={state.previous}
                  onNext={() => state.next(query.data?.pageInfo.nextCursor ?? null)}
                />
              </>
            )}
          </Card>
        </>
      )}
      <RecordDialog
        open={creating}
        onOpenChange={setCreating}
        title="Nova tarefa"
        fallbackFocus={button}
      >
        {creating && <TaskForm onSaved={() => setCreating(false)} />}
      </RecordDialog>
    </>
  );
}
