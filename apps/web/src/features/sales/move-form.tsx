'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { moveOpportunitySchema } from '@crm/contracts';
import type { MoveOpportunity, OpportunityResponse } from '@crm/contracts';
import { Alert, Button, Select, FormField, toast } from '@crm/ui';
import { usePipeline, useMoveOpportunity } from './queries';
import { QueryError } from '@/features/commercial/query-feedback';
import { RecordField } from '@/features/commercial/record-fields';
import { errorMessage } from '@/lib/api-client';
export function MoveForm({
  record,
  selectedStage = '',
  onSaved,
}: {
  record: OpportunityResponse;
  selectedStage?: string;
  onSaved: () => void;
}) {
  const pipeline = usePipeline(record.pipeline.id),
    mutation = useMoveOpportunity();
  const {
    register,
    setValue,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MoveOpportunity>({
    resolver: zodResolver(moveOpportunitySchema),
    defaultValues: { expectedVersion: record.version, stageId: selectedStage },
  });
  const stageId = useWatch({ control, name: 'stageId' }),
    stage = pipeline.data?.stages.find((item) => item.id === stageId);
  const submit = async (input: MoveOpportunity) => {
    if (!stage) {
      setError('stageId', { message: 'Selecione uma etapa disponível.' });
      return;
    }
    if (stage.kind === 'LOST' && !input.reason) {
      setError('reason', { message: 'Informe o motivo da perda.' });
      return;
    }
    try {
      await mutation.mutateAsync({ record, input, stage });
      toast.success('Etapa atualizada.');
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
      <FormField id="move-stage" label="Nova etapa" error={errors.stageId?.message}>
        <Select
          id="move-stage"
          label="Nova etapa"
          value={stageId}
          options={[
            { value: '', label: 'Selecione uma etapa' },
            ...(
              pipeline.data?.stages.filter((item) => item.active && item.id !== record.stage.id) ??
              []
            ).map((item) => ({ value: item.id, label: item.name })),
          ]}
          onValueChange={(id) => {
            setValue('stageId', id);
            setValue('reason', undefined);
          }}
          disabled={pipeline.isPending}
        />
      </FormField>
      {pipeline.data && !pipeline.data.active && (
        <Alert>Este pipeline foi arquivado. Movimentações estão bloqueadas.</Alert>
      )}
      {pipeline.isError && (
        <QueryError
          error={pipeline.error}
          retry={() => {
            void pipeline.refetch();
          }}
        />
      )}
      {stage?.kind === 'LOST' && (
        <RecordField
          field="reason"
          label="Motivo da perda"
          required
          multiline
          register={register}
          errors={errors}
        />
      )}
      <Button type="submit" loading={isSubmitting} disabled={!stage || !pipeline.data?.active}>
        Confirmar movimentação
      </Button>
    </form>
  );
}
