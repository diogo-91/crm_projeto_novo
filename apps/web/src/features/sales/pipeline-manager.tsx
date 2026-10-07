'use client';
import { useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createPipelineSchema,
  addStageSchema,
  updateStageSchema,
  branchListResponseSchema,
  dealStatusSchema,
} from '@crm/contracts';
import type {
  CreatePipeline,
  AddStage,
  UpdateStage,
  PipelineResponse,
  StageResponse,
} from '@crm/contracts';
import type { z } from 'zod';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Alert, Button, Input, FormField, Select, toast } from '@crm/ui';
import { useCommercialContext, commercialKeys, queryString } from '@/features/commercial/queries';
import { RecordField } from '@/features/commercial/record-fields';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { QueryError } from '@/features/commercial/query-feedback';
import { usePipelineMutation } from './queries';
import { errorMessage } from '@/lib/api-client';
export function PipelineCreateForm({ onSaved }: { onSaved: () => void }) {
  const { context, session } = useCommercialContext();
  const mutation = usePipelineMutation();
  const branches = useInfiniteQuery({
    queryKey: commercialKeys.list(
      context.organizationId,
      context.membershipId,
      context.cacheScopeKey,
      'pipeline-branches',
      {},
    ),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) =>
      session.request(
        `organizations/${context.organizationId}/branches?${queryString({ cursor: pageParam, limit: '100' })}`,
        branchListResponseSchema,
        { signal },
      ),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes('branches.read'),
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createPipelineSchema>, unknown, CreatePipeline>({
    resolver: zodResolver(createPipelineSchema),
    defaultValues: {
      name: '',
      branchId: null,
      stages: [
        { name: 'Entrada', kind: 'OPEN' },
        { name: 'Ganha', kind: 'WON' },
        { name: 'Perdida', kind: 'LOST' },
      ],
    },
  });
  const selectedBranch = useWatch({ control, name: 'branchId' });
  const { fields, append, remove } = useFieldArray({ control, name: 'stages' });
  const submit = async (input: CreatePipeline) => {
    try {
      await mutation.mutateAsync({ type: 'create', input });
      toast.success('Pipeline criado.');
      onSaved();
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  };
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
    >
      {errors.root?.message && <Alert>{errors.root.message}</Alert>}
      <RecordField
        field="name"
        label="Nome do pipeline"
        required
        register={register}
        errors={errors}
      />
      <FormField id="pipeline-branch" label="Disponível para">
        <Select
          id="pipeline-branch"
          value={selectedBranch ?? ''}
          label="Disponível para"
          options={[
            { value: '', label: 'Todas as filiais da organização' },
            ...(branches.data?.pages.flatMap((page) => page.data) ?? [])
              .filter((branch) => branch.active)
              .map((branch) => ({ value: branch.id, label: branch.name })),
          ]}
          onValueChange={(id) => setValue('branchId', id || null)}
        />
        {branches.isError && (
          <QueryError
            error={branches.error}
            retry={() => {
              void branches.refetch();
            }}
          />
        )}
        {branches.hasNextPage && (
          <Button
            variant="link"
            onClick={() => {
              void branches.fetchNextPage();
            }}
          >
            Mais filiais
          </Button>
        )}
      </FormField>
      <fieldset className="space-y-4">
        <legend className="mb-3 font-semibold">Etapas iniciais</legend>
        {fields.map((field, index) => (
          <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3" key={field.id}>
            <FormField
              id={`stage-name-${index}`}
              label={`Nome da etapa ${index + 1}`}
              error={errors.stages?.[index]?.name?.message}
            >
              <Input id={`stage-name-${index}`} {...register(`stages.${index}.name`)} />
            </FormField>
            <FormField id={`stage-kind-${index}`} label={`Resultado da etapa ${index + 1}`}>
              <select
                className="h-10 w-full rounded-lg border bg-surface px-3 text-body"
                id={`stage-kind-${index}`}
                {...register(`stages.${index}.kind`)}
              >
                <option value="OPEN">Aberta</option>
                <option value="WON">Ganha</option>
                <option value="LOST">Perdida</option>
              </select>
            </FormField>
            <Button variant="outline" disabled={fields.length <= 1} onClick={() => remove(index)}>
              Remover etapa {index + 1}
            </Button>
          </div>
        ))}
        {errors.stages?.message && <Alert>{errors.stages.message}</Alert>}
        <Button
          variant="outline"
          disabled={fields.length >= 30}
          onClick={() => append({ name: '', kind: 'OPEN' })}
        >
          Adicionar etapa
        </Button>
      </fieldset>
      <Button type="submit" loading={isSubmitting}>
        Salvar pipeline
      </Button>
    </form>
  );
}
function StageForm({
  pipeline,
  stage,
  onSaved,
}: {
  pipeline: PipelineResponse;
  stage?: StageResponse;
  onSaved: () => void;
}) {
  const mutation = usePipelineMutation(pipeline.id);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof addStageSchema>, unknown, AddStage>({
    resolver: zodResolver(addStageSchema),
    defaultValues: {
      name: stage?.name ?? '',
      kind: stage?.kind ?? 'OPEN',
      expectedVersion: pipeline.version,
    },
  });
  const submit = async (input: AddStage) => {
    try {
      await mutation.mutateAsync(
        stage
          ? {
              type: 'stage',
              stageId: stage.id,
              input: updateStageSchema.parse({
                name: input.name,
                expectedVersion: input.expectedVersion,
              }),
            }
          : { type: 'add', input },
      );
      toast.success('Etapa salva.');
      onSaved();
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  };
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
    >
      {errors.root?.message && <Alert>{errors.root.message}</Alert>}
      <RecordField
        field="name"
        label="Nome da etapa"
        required
        register={register}
        errors={errors}
      />
      {!stage ? (
        <FormField id="stage-kind" label="Resultado">
          <select
            id="stage-kind"
            className="h-10 w-full rounded-lg border bg-surface px-3 text-body"
            {...register('kind')}
          >
            {dealStatusSchema.options.map((kind) => (
              <option key={kind} value={kind}>
                {kind === 'OPEN' ? 'Aberta' : kind === 'WON' ? 'Ganha' : 'Perdida'}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <p className="text-body">O resultado da etapa é fixo para preservar o histórico.</p>
      )}
      <Button type="submit" loading={isSubmitting}>
        Salvar etapa
      </Button>
    </form>
  );
}
export function PipelineManager({ pipeline }: { pipeline: PipelineResponse }) {
  const mutation = usePipelineMutation(pipeline.id),
    [stage, setStage] = useState<StageResponse | 'new' | null>(null),
    [name, setName] = useState(pipeline.name),
    [confirmArchive, setConfirmArchive] = useState(false);
  const act = (operation: Parameters<typeof mutation.mutate>[0]) =>
    mutation.mutate(operation, { onSuccess: () => toast.success('Pipeline atualizado.') });
  return (
    <section className="mt-6 space-y-4 rounded-lg border bg-surface p-5">
      <h2 className="text-lg font-semibold">Configurar pipeline</h2>
      {mutation.isError && (
        <QueryError
          error={mutation.error}
          retry={() => {
            void mutation.reset();
          }}
        />
      )}
      <FormField id="pipeline-name-edit" label="Nome do pipeline">
        <Input
          id="pipeline-name-edit"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <Button
        variant="outline"
        disabled={!name.trim() || mutation.isPending}
        onClick={() =>
          act({ type: 'update', input: { name: name.trim(), expectedVersion: pipeline.version } })
        }
      >
        Salvar nome
      </Button>
      <ul className="space-y-3">
        {pipeline.stages.map((item, index) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <span className="mr-auto text-body">
              {item.name}
              {!item.active ? ' · inativa' : ''}
            </span>
            <Button
              variant="outline"
              disabled={mutation.isPending || index === 0}
              aria-label={`Mover ${item.name} para a esquerda`}
              onClick={() => {
                const ids = pipeline.stages.map((stage) => stage.id);
                ids.splice(index, 1);
                ids.splice(index - 1, 0, item.id);
                act({
                  type: 'reorder',
                  input: { stageIds: ids, expectedVersion: pipeline.version },
                });
              }}
            >
              ←
            </Button>
            <Button
              variant="outline"
              disabled={mutation.isPending || index === pipeline.stages.length - 1}
              aria-label={`Mover ${item.name} para a direita`}
              onClick={() => {
                const ids = pipeline.stages.map((stage) => stage.id);
                ids.splice(index, 1);
                ids.splice(index + 1, 0, item.id);
                act({
                  type: 'reorder',
                  input: { stageIds: ids, expectedVersion: pipeline.version },
                });
              }}
            >
              →
            </Button>
            <Button variant="outline" onClick={() => setStage(item)}>
              Editar {item.name}
            </Button>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                const input: UpdateStage = {
                  active: !item.active,
                  expectedVersion: pipeline.version,
                };
                act({ type: 'stage', stageId: item.id, input });
              }}
            >
              {item.active ? 'Desativar' : 'Ativar'} {item.name}
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        disabled={pipeline.stages.length >= 30 || !pipeline.active}
        onClick={() => setStage('new')}
      >
        Nova etapa
      </Button>
      <Button variant="danger" disabled={!pipeline.active} onClick={() => setConfirmArchive(true)}>
        Arquivar pipeline
      </Button>
      <RecordDialog
        open={stage !== null}
        onOpenChange={(open) => {
          if (!open) setStage(null);
        }}
        title={stage === 'new' ? 'Nova etapa' : 'Editar etapa'}
      >
        {stage && (
          <StageForm
            key={pipeline.version}
            pipeline={pipeline}
            {...(stage === 'new' ? {} : { stage })}
            onSaved={() => setStage(null)}
          />
        )}
      </RecordDialog>
      <RecordDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Arquivar pipeline"
      >
        <p className="mb-4 text-body">
          Novas oportunidades e movimentações serão bloqueadas. Os registros existentes e seus
          históricos serão preservados.
        </p>
        {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}
        <Button
          variant="danger"
          loading={mutation.isPending}
          onClick={() =>
            mutation.mutate(
              { type: 'archive', input: { expectedVersion: pipeline.version } },
              {
                onSuccess: () => {
                  toast.success('Pipeline arquivado.');
                  setConfirmArchive(false);
                },
              },
            )
          }
        >
          Confirmar arquivamento
        </Button>
      </RecordDialog>
    </section>
  );
}
