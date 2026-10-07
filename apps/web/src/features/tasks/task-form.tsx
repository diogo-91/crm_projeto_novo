'use client';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Select, Textarea, FormField, Alert, toast } from '@crm/ui';
import { createTaskSchema } from '@crm/contracts';
import type { TaskResponse, ResourceTarget } from '@crm/contracts';
import { AssignmentSelect } from '@/features/commercial/assignment-fields';
import { useCommercialContext } from '@/features/commercial/queries';
import { useSaveTask } from './queries';
import { TargetPicker } from './target-picker';
import { TaskTargetSummary } from './task-target';
import { localDateInput, utcFromLocal, taskLabels, priorityLabels } from './dates';
import { errorMessage } from '@/lib/api-client';
const fields = z.object({
  name: z.string().trim().min(1, 'Informe o título.').max(160),
  description: z.string().max(4000),
  branchId: z.uuid(),
  ownerMembershipId: z.uuid().or(z.literal('')),
  kind: z.enum(['TASK', 'FOLLOW_UP']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']),
  dueAt: z.string(),
  remindAt: z.string(),
  target: z.object({ type: z.enum(['contact', 'lead', 'opportunity']), id: z.uuid() }).nullable(),
});
export function TaskForm({
  record,
  target,
  onSaved,
}: {
  record?: TaskResponse;
  target?: ResourceTarget;
  onSaved: () => void;
}) {
  const { context } = useCommercialContext();
  const save = useSaveTask(record?.id);
  const form = useForm<z.infer<typeof fields>>({
    resolver: zodResolver(fields),
    defaultValues: {
      name: record?.name ?? '',
      description: record?.description ?? '',
      branchId: record?.branch.id ?? context.primaryBranchId ?? context.branches[0]?.id ?? '',
      ownerMembershipId: record?.owner.id ?? context.membershipId,
      kind: record?.kind ?? (target ? 'FOLLOW_UP' : 'TASK'),
      priority: record?.priority ?? 'NORMAL',
      dueAt: localDateInput(record?.dueAt ?? null),
      remindAt: localDateInput(record?.remindAt ?? null),
      target: record?.target ?? target ?? null,
    },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      const input = createTaskSchema.parse({
        ...values,
        description: values.description.trim() || null,
        ownerMembershipId: values.ownerMembershipId || undefined,
        dueAt:
          record && values.dueAt === localDateInput(record.dueAt)
            ? record.dueAt
            : utcFromLocal(values.dueAt),
        remindAt:
          record && values.remindAt === localDateInput(record.remindAt)
            ? record.remindAt
            : utcFromLocal(values.remindAt),
      });
      await save.mutateAsync(record ? { ...input, expectedVersion: record.version } : input);
      toast.success(record ? 'Tarefa atualizada.' : 'Tarefa criada.');
      onSaved();
    } catch (error: unknown) {
      form.setError('root', {
        message:
          error instanceof z.ZodError
            ? error.issues.map((i) => i.message).join(' ')
            : errorMessage(error),
      });
    }
  });
  const action = record ? 'update' : 'create';
  const branchId = useWatch({ control: form.control, name: 'branchId' });
  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="space-y-5"
    >
      <FormField id="task-name" label="Título" required error={form.formState.errors.name?.message}>
        <Input
          id="task-name"
          {...form.register('name')}
          aria-invalid={Boolean(form.formState.errors.name)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormField id="task-kind" label="Finalidade">
              <Select
                id="task-kind"
                label="Finalidade"
                value={field.value}
                options={Object.entries(taskLabels).map(([value, label]) => ({ value, label }))}
                onValueChange={field.onChange}
              />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormField id="task-priority" label="Prioridade">
              <Select
                id="task-priority"
                label="Prioridade"
                value={field.value}
                options={Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))}
                onValueChange={field.onChange}
              />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="branchId"
          render={({ field }) => (
            <AssignmentSelect
              resource="tasks"
              kind="branches"
              action={action}
              value={field.value}
              label="Filial"
              onChange={(value) => {
                field.onChange(value);
                form.setValue('ownerMembershipId', context.membershipId);
              }}
              existing={record?.branch}
            />
          )}
        />
        <Controller
          control={form.control}
          name="ownerMembershipId"
          render={({ field }) => (
            <AssignmentSelect
              resource="tasks"
              kind="owners"
              action={action}
              branchId={branchId}
              value={field.value}
              label="Responsável"
              onChange={field.onChange}
              existing={record?.owner}
            />
          )}
        />
        <FormField id="task-due" label="Vencimento">
          <Input id="task-due" type="datetime-local" {...form.register('dueAt')} />
        </FormField>
        <FormField id="task-remind" label="Lembrar em">
          <Input id="task-remind" type="datetime-local" {...form.register('remindAt')} />
        </FormField>
      </div>
      <p className="text-caption text-muted">
        Horários em {Intl.DateTimeFormat().resolvedOptions().timeZone}. O lembrete aparece nas
        notificações do responsável.
      </p>
      <FormField id="task-description" label="Descrição">
        <Textarea id="task-description" {...form.register('description')} />
      </FormField>
      {target ? (
        <TaskTargetSummary target={target} />
      ) : (
        <Controller
          control={form.control}
          name="target"
          render={({ field }) => <TargetPicker value={field.value} onChange={field.onChange} />}
        />
      )}{' '}
      {form.formState.errors.root?.message && <Alert>{form.formState.errors.root.message}</Alert>}
      <Button type="submit" loading={save.isPending}>
        Salvar tarefa
      </Button>
    </form>
  );
}
