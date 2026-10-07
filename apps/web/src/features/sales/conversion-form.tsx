'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { conversionSchema, currencySchema } from '@crm/contracts';
import type { ConvertLead, LeadResponse } from '@crm/contracts';
import type { z } from 'zod';
import { Alert, Button, FormField, Select, toast } from '@crm/ui';
import { useConvertLead } from './queries';
import { PipelinePicker } from './pipeline-picker';
import { ContactPicker } from './contact-picker';
import { CompanyPicker } from '@/features/commercial/company-picker';
import { RecordField } from '@/features/commercial/record-fields';
import { usePermission } from '@/features/auth/auth-provider';
import { errorMessage } from '@/lib/api-client';
export function ConversionForm({ record, onSaved }: { record: LeadResponse; onSaved: () => void }) {
  const mutation = useConvertLead(record.id);
  const canCreateContact = usePermission('contacts.create'),
    canCreateCompany = usePermission('companies.create');
  const canReadContact = usePermission('contacts.read'),
    canReadCompany = usePermission('companies.read');
  const {
    register,
    control,
    setValue,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<z.input<typeof conversionSchema>, unknown, ConvertLead>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      expectedVersion: record.version,
      pipelineId: '',
      stageId: '',
      opportunityName: record.name,
      amount: '0',
      currency: 'BRL',
      createContact: false,
      createCompany: false,
      contactId: record.contact?.id ?? null,
      companyId: record.company?.id ?? null,
    },
  });
  const pipelineId = useWatch({ control, name: 'pipelineId' }),
    stageId = useWatch({ control, name: 'stageId' });
  const contactId = useWatch({ control, name: 'contactId' }),
    companyId = useWatch({ control, name: 'companyId' });
  const createContact = useWatch({ control, name: 'createContact' }),
    createCompany = useWatch({ control, name: 'createCompany' }),
    currency = useWatch({ control, name: 'currency' });
  const submit = async (input: ConvertLead) => {
    try {
      const payload = { ...input };
      if (!canReadContact || !dirtyFields.contactId) delete payload.contactId;
      if (!canReadCompany || !dirtyFields.companyId) delete payload.companyId;
      await mutation.mutateAsync(payload);
      toast.success('Lead convertido em oportunidade.');
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
        field="opportunityName"
        label="Nome da oportunidade"
        required
        register={register}
        errors={errors}
      />
      <PipelinePicker
        pipelineId={pipelineId}
        stageId={stageId}
        branchId={record.branch.id}
        openOnly
        error={errors.pipelineId?.message ?? errors.stageId?.message}
        onPipeline={(id) => {
          setValue('pipelineId', id);
          setValue('stageId', '');
        }}
        onStage={(id) => setValue('stageId', id)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <RecordField field="amount" label="Valor" required register={register} errors={errors} />
        <FormField id="convert-currency" label="Moeda">
          <Select
            id="convert-currency"
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
      {canCreateContact && record.phone && (
        <label className="flex items-center gap-3 text-body">
          <input
            type="checkbox"
            {...register('createContact')}
            onChange={(event) => {
              setValue('createContact', event.target.checked);
              if (event.target.checked) setValue('contactId', null, { shouldDirty: true });
            }}
          />
          Criar cliente com os dados do lead
        </label>
      )}
      {!createContact && canReadContact && (
        <ContactPicker
          value={contactId ?? ''}
          existing={record.contact}
          onChange={(id) => setValue('contactId', id || null, { shouldDirty: true })}
        />
      )}
      {canCreateCompany && record.companyName && (
        <label className="flex items-center gap-3 text-body">
          <input
            type="checkbox"
            {...register('createCompany')}
            onChange={(event) => {
              setValue('createCompany', event.target.checked);
              if (event.target.checked) setValue('companyId', null, { shouldDirty: true });
            }}
          />
          Criar empresa com os dados do lead
        </label>
      )}
      {!createCompany && canReadCompany && (
        <CompanyPicker
          value={companyId ?? ''}
          existing={record.company}
          onChange={(id) => setValue('companyId', id || null, { shouldDirty: true })}
        />
      )}
      <p className="text-caption text-muted">
        A conversão preserva a filial e o responsável. Se ocorrer conflito, nenhum registro será
        criado parcialmente.
      </p>
      <Button type="submit" loading={isSubmitting}>
        Confirmar conversão
      </Button>
    </form>
  );
}
