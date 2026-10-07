'use client';
import { useState, useRef } from 'react';
import { Button, Card, EmptyState, Alert, toast } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { RecordSummary } from '@/features/commercial/record-summary';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { usePermission } from '@/features/auth/auth-provider';
import { errorMessage } from '@/lib/api-client';
import { useTask, useTaskCommand, useTaskHistory, useReminder, useRetryReminder } from './queries';
import { TaskForm } from './task-form';
import { taskLabels, priorityLabels } from './dates';
import { TaskTargetSummary } from './task-target';
import { TimelineEntries } from './timeline';
export function TaskDetail({ id }: { id: string }) {
  const query = useTask(id);
  const change = useTaskCommand();
  const history = useTaskHistory(id);
  const reminder = useReminder(id);
  const retry = useRetryReminder();
  const [editing, setEditing] = useState(false),
    [command, setCommand] = useState<'complete' | 'reopen' | 'archive' | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const read = usePermission('tasks.read'),
    update = usePermission('tasks.update'),
    complete = usePermission('tasks.complete'),
    remove = usePermission('tasks.delete');
  if (!read)
    return <EmptyState title="Acesso negado" description="Sem permissão para consultar tarefas." />;
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
  const execute = async () => {
    if (!command) return;
    try {
      await change.mutateAsync({ id, version: row.version, command });
      toast.success('Tarefa atualizada.');
      setCommand(null);
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };
  const reminderLabels = {
    PENDING: 'Pendente',
    DISPATCHED: 'Em processamento',
    COMPLETED: 'Entregue',
    CANCELED: 'Cancelado',
    FAILED: 'Falhou',
  };
  return (
    <>
      <PageHeader
        title={row.name}
        description={`${taskLabels[row.kind]} · ${row.status === 'COMPLETED' ? 'Concluída' : 'Pendente'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {row.active && update && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Editar tarefa
              </Button>
            )}
            {row.active && complete && (
              <Button onClick={() => setCommand(row.status === 'OPEN' ? 'complete' : 'reopen')}>
                {row.status === 'OPEN' ? 'Concluir tarefa' : 'Reabrir tarefa'}
              </Button>
            )}
            {row.active && remove && (
              <Button variant="danger" onClick={() => setCommand('archive')}>
                Arquivar tarefa
              </Button>
            )}
          </div>
        }
      />
      <RecordSummary
        notes={row.description}
        items={[
          { label: 'Filial', value: row.branch.name },
          { label: 'Responsável', value: row.owner.name },
          { label: 'Prioridade', value: priorityLabels[row.priority] },
          {
            label: 'Vencimento',
            value: row.dueAt ? new Date(row.dueAt).toLocaleString('pt-BR') : 'Sem vencimento',
          },
          {
            label: 'Lembrete',
            value: row.remindAt ? new Date(row.remindAt).toLocaleString('pt-BR') : 'Sem lembrete',
          },
          {
            label: 'Conclusão',
            value: row.completedAt ? new Date(row.completedAt).toLocaleString('pt-BR') : 'Pendente',
          },
          {
            label: 'Vínculo',
            value: row.target ? <TaskTargetSummary target={row.target} /> : 'Sem vínculo',
          },
          { label: 'Registro', value: row.active ? 'Ativo' : 'Arquivado' },
        ]}
      />
      {reminder.isError ? (
        <QueryError
          error={reminder.error}
          retry={() => {
            void reminder.refetch();
          }}
        />
      ) : (
        reminder.data && (
          <Card className="mt-5 p-5">
            <p className="font-medium">Lembrete: {reminderLabels[reminder.data.state]}</p>
            <p className="text-caption text-muted">
              Tentativas com falha: {reminder.data.attemptCount}
            </p>
            {reminder.data.state === 'FAILED' && update && row.active && row.status === 'OPEN' && (
              <Button
                className="mt-3"
                loading={retry.isPending}
                onClick={() => {
                  void retry
                    .mutateAsync({ id, version: row.version })
                    .then(() => toast.success('Nova tentativa solicitada.'))
                    .catch((error) => toast.error(errorMessage(error)));
                }}
              >
                Tentar lembrete novamente
              </Button>
            )}
          </Card>
        )
      )}
      <h2 ref={heading} tabIndex={-1} className="mb-4 mt-8 text-xl font-semibold">
        Histórico da tarefa
      </h2>
      <Card>
        <TimelineEntries query={history} />
      </Card>
      <RecordDialog
        open={editing}
        onOpenChange={setEditing}
        title="Editar tarefa"
        fallbackFocus={heading}
      >
        {editing && <TaskForm key={row.version} record={row} onSaved={() => setEditing(false)} />}
      </RecordDialog>
      <RecordDialog
        open={Boolean(command)}
        onOpenChange={(open) => {
          if (!open) setCommand(null);
        }}
        title={
          command === 'archive'
            ? 'Arquivar tarefa'
            : command === 'complete'
              ? 'Concluir tarefa'
              : 'Reabrir tarefa'
        }
        fallbackFocus={heading}
      >
        <Alert>
          {command === 'archive'
            ? 'A tarefa e seu histórico serão preservados. O lembrete pendente será cancelado.'
            : 'Confirme a alteração da situação da tarefa.'}
        </Alert>
        <Button
          className="mt-4"
          loading={change.isPending}
          onClick={() => {
            void execute();
          }}
        >
          Confirmar alteração
        </Button>
      </RecordDialog>
    </>
  );
}
