'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createOpportunitySchema, currencySchema } from '@crm/contracts';
import type { OpportunityResponse, CreateOpportunity } from '@crm/contracts';
import type { z } from 'zod';
import { Alert, Button, FormField, Select, toast } from '@crm/ui';
import { useCommercialContext } from '@/features/commercial/queries';
import { useSaveOpportunity } from './queries';
import { RecordField } from '@/features/commercial/record-fields';
import { AssignmentSelect } from '@/features/commercial/assignment-fields';
import { ContactPicker } from './contact-picker';
import { CompanyPicker } from '@/features/commercial/company-picker';
import { usePermission } from '@/features/auth/auth-provider';
import { ApiError, errorMessage } from '@/lib/api-client';
import { PipelinePicker } from './pipeline-picker';
type Input = z.input<typeof createOpportunitySchema>;
export function OpportunityForm({
  record,
  onSaved,
}: {
  record?: OpportunityResponse;
  onSaved: () => void;
}) {
  const { context } = useCommercialContext();
  const mutation = useSaveOpportunity(record?.id);
  const canAssign = usePermission('opportunities.assign');
  const canContact = usePermission('contacts.read');
  const canCompany = usePermission('companies.read');
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Input, unknown, CreateOpportunity>({
    resolver: zodResolver(createOpportunitySchema),
    defaultValues: {
      name: record?.name ?? '',
      notes: record?.notes ?? null,
      branchId: record?.branch.id ?? context.primaryBranchId ?? '',
      ownerMembershipId: record?.owner.id ?? context.membershipId,
      contactId: record?.contact?.id ?? null,
      companyId: record?.company?.id ?? null,
      pipelineId: record?.pipeline.id ?? '',
      stageId: record?.stage.id ?? '',
      amount: record?.amount ?? '0',
      currency: record?.currency ?? 'BRL',
    },
  });
  const branchId = useWatch({ control, name: 'branchId' });
  const ownerMembershipId = useWatch({ control, name: 'ownerMembershipId' });
  const pipelineId = useWatch({ control, name: 'pipelineId' });
  const stageId = useWatch({ control, name: 'stageId' });
  const currency = useWatch({ control, name: 'currency' });
  const contactId = useWatch({ control, name: 'contactId' });
  const companyId = useWatch({ control, name: 'companyId' });
  const submit = async (input: CreateOpportunity) => {
    try {
      const { pipelineId: selectedPipeline, stageId: selectedStage, ...payload } = input;
      if (!canContact || (record && !dirtyFields.contactId)) delete payload.contactId;
      if (!canCompany || (record && !dirtyFields.companyId)) delete payload.companyId;
      // Preserve hidden associations; PATCH contains only relationships the actor can inspect.
      await mutation.mutateAsync(
        record
          ? {
              ...payload,
              expectedVersion: record.version,
            }
          : { ...payload, pipelineId: selectedPipeline, stageId: selectedStage },
      );
      toast.success(record ? 'Oportunidade atualizado.' : 'Oportunidade criado.');
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        setError('root', {
          message:
            'O registro foi alterado ou há dados conflitantes. Recarregue e confira os campos.',
        });
      else setError('root', { message: errorMessage(error) });
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
      <div className="grid gap-5 sm:grid-cols-2">
        <RecordField field="name" label="Nome" required register={register} errors={errors} />
        {!record || canAssign ? (
          <AssignmentSelect
            resource="opportunities"
            kind="branches"
            action={record ? 'update' : 'create'}
            value={branchId}
            label="Filial"
            error={errors.branchId?.message}
            existing={record?.branch}
            onChange={(value) => {
              setValue('branchId', value, { shouldValidate: true });
              setValue('ownerMembershipId', '');
              if (!record) {
                setValue('pipelineId', '');
                setValue('stageId', '');
              }
            }}
          />
        ) : (
          <p className="text-body">Filial: {record.branch.name}</p>
        )}
        {!record || canAssign ? (
          <AssignmentSelect
            resource="opportunities"
            kind="owners"
            action={record ? 'update' : 'create'}
            branchId={branchId}
            value={ownerMembershipId ?? ''}
            label="Responsável"
            error={errors.ownerMembershipId?.message}
            existing={record?.owner}
            onChange={(value) => setValue('ownerMembershipId', value, { shouldValidate: true })}
          />
        ) : (
          <p className="text-body">Responsável: {record.owner.name}</p>
        )}
      </div>
      {!record && (
        <PipelinePicker
          pipelineId={pipelineId}
          stageId={stageId}
          branchId={branchId}
          openOnly
          error={errors.pipelineId?.message ?? errors.stageId?.message}
          onPipeline={(value) => {
            setValue('pipelineId', value);
            setValue('stageId', '');
          }}
          onStage={(value) => setValue('stageId', value)}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <RecordField field="amount" label="Valor" required register={register} errors={errors} />
        <FormField id="record-currency" label="Moeda">
          <Select
            id="record-currency"
            label="Moeda"
            value={currency ?? 'BRL'}
            options={currencySchema.options.map((value) => ({ value, label: value }))}
            onValueChange={(value) => {
              const parsed = currencySchema.safeParse(value);
              if (parsed.success) setValue('currency', parsed.data);
            }}
          />
        </FormField>
      </div>
      {canContact && (
        <ContactPicker
          value={contactId ?? ''}
          existing={record?.contact}
          onChange={(value) => setValue('contactId', value || null, { shouldDirty: true })}
        />
      )}
      {canCompany && (
        <CompanyPicker
          value={companyId ?? ''}
          existing={record?.company}
          onChange={(value) => setValue('companyId', value || null, { shouldDirty: true })}
        />
      )}
      <RecordField
        field="notes"
        label="Observações"
        multiline
        register={register}
        errors={errors}
      />
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Salvar oportunidade
        </Button>
      </div>
    </form>
  );
}
