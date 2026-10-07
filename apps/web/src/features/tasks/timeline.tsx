'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button, Card, EmptyState, FormField, Select, Textarea, Alert, toast } from '@crm/ui';
import { createActivitySchema } from '@crm/contracts';
import type { ResourceTarget } from '@crm/contracts';
import { usePermission } from '@/features/auth/auth-provider';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { errorMessage } from '@/lib/api-client';
import { useTimeline, useCreateActivity } from './queries';
import { TaskForm } from './task-form';
import { eventLabels } from './dates';
export function TimelineEntries({ query }: { query: ReturnType<typeof useTimeline> }) {
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
  const rows = query.data.pages.flatMap((page) => page.data);
  return (
    <>
      {!rows.length ? (
        <EmptyState
          title="Nenhuma atividade registrada"
          description="As interações e mudanças aparecerão aqui."
        />
      ) : (
        <ol className="space-y-5 p-5">
          {rows.map((row) => (
            <li key={`${row.type}-${row.id}`} className="border-l-2 pl-4">
              <p className="font-medium">
                {eventLabels[row.name as keyof typeof eventLabels] ?? row.name}
              </p>
              <time className="text-caption text-muted" dateTime={row.createdAt}>
                {new Date(row.createdAt).toLocaleString('pt-BR')}
              </time>
              {row.description && (
                <p className="mt-2 whitespace-pre-wrap break-words text-body">{row.description}</p>
              )}
              {row.taskId && (
                <Link
                  className="mt-2 block text-foreground underline"
                  href={`/tasks/${row.taskId}`}
                >
                  Abrir tarefa
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
      {query.hasNextPage && (
        <Button
          className="m-5"
          variant="secondary"
          loading={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
          }}
        >
          Carregar mais atividades
        </Button>
      )}
    </>
  );
}
function ActivityForm({ target, onSaved }: { target: ResourceTarget; onSaved: () => void }) {
  const save = useCreateActivity();
  const form = useForm<
    z.input<typeof createActivitySchema>,
    unknown,
    z.output<typeof createActivitySchema>
  >({
    resolver: zodResolver(createActivitySchema),
    defaultValues: { target, kind: 'NOTE', description: '' },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        void form.handleSubmit(async (input) => {
          try {
            await save.mutateAsync(input);
            toast.success('Interação registrada.');
            onSaved();
          } catch (error: unknown) {
            form.setError('root', { message: errorMessage(error) });
          }
        })(event);
      }}
    >
      <Controller
        control={form.control}
        name="kind"
        render={({ field }) => (
          <FormField id="activity-kind" label="Tipo de interação">
            <Select
              id="activity-kind"
              label="Tipo de interação"
              value={field.value ?? 'NOTE'}
              options={['NOTE', 'CALL', 'EMAIL', 'MEETING'].map((value) => ({
                value,
                label: eventLabels[value as keyof typeof eventLabels],
              }))}
              onValueChange={field.onChange}
            />
          </FormField>
        )}
      />
      <FormField
        id="activity-description"
        label="Descrição da interação"
        required
        error={form.formState.errors.description?.message}
      >
        <Textarea
          id="activity-description"
          {...form.register('description')}
          aria-invalid={Boolean(form.formState.errors.description)}
        />
      </FormField>
      {form.formState.errors.root?.message && <Alert>{form.formState.errors.root.message}</Alert>}
      <Button type="submit" loading={save.isPending}>
        Registrar interação
      </Button>
    </form>
  );
}
export function Timeline({ target, active = true }: { target: ResourceTarget; active?: boolean }) {
  const query = useTimeline(target);
  const read = usePermission('activities.read'),
    create = usePermission('activities.create'),
    task = usePermission('tasks.create');
  const [adding, setAdding] = useState(false),
    [following, setFollowing] = useState(false);
  const heading = useRef<HTMLHeadingElement | null>(null);
  if (!read) return null;
  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
          Timeline
        </h2>
        <div className="flex flex-wrap gap-2">
          {active && task && (
            <Button variant="secondary" onClick={() => setFollowing(true)}>
              Novo follow-up
            </Button>
          )}
          {active && create && (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              Registrar interação
            </Button>
          )}
        </div>
      </div>
      <Card>
        <TimelineEntries query={query} />
      </Card>
      <RecordDialog
        open={adding}
        onOpenChange={setAdding}
        title="Registrar interação"
        fallbackFocus={heading}
      >
        {adding && <ActivityForm target={target} onSaved={() => setAdding(false)} />}
      </RecordDialog>
      <RecordDialog
        open={following}
        onOpenChange={setFollowing}
        title="Novo follow-up"
        fallbackFocus={heading}
      >
        {following && <TaskForm target={target} onSaved={() => setFollowing(false)} />}
      </RecordDialog>
    </section>
  );
}
