'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createLeadSchema, contactSources, leadStatusSchema } from '@crm/contracts';
import type { LeadResponse } from '@crm/contracts';
import type { z } from 'zod';
import { Alert, Button, FormField, Select, toast } from '@crm/ui';
import { useCommercialContext } from '@/features/commercial/queries';
import { useSaveLead } from './queries';
import { RecordField } from '@/features/commercial/record-fields';
import { AssignmentSelect } from '@/features/commercial/assignment-fields';
import { ContactPicker } from './contact-picker';
import { CompanyPicker } from '@/features/commercial/company-picker';
import { usePermission } from '@/features/auth/auth-provider';
import { ApiError, errorMessage } from '@/lib/api-client';
import { sourceLabels } from '@/features/commercial/source-labels';
const formSchema = createLeadSchema.extend({
  status: leadStatusSchema.exclude(['CONVERTED']).optional(),
});
type Input = z.input<typeof formSchema>;
type FormData = z.output<typeof formSchema>;
export function LeadForm({ record, onSaved }: { record?: LeadResponse; onSaved: () => void }) {
  const { context } = useCommercialContext();
  const mutation = useSaveLead(record?.id);
  const canAssign = usePermission('leads.assign');
  const canContact = usePermission('contacts.read');
  const canCompany = usePermission('companies.read');
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Input, unknown, FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: record?.name ?? '',
      phone: record?.phone ?? null,
      email: record?.email ?? null,
      notes: record?.notes ?? null,
      branchId: record?.branch.id ?? context.primaryBranchId ?? '',
      ownerMembershipId: record?.owner.id ?? context.membershipId,
      contactId: record?.contact?.id ?? null,
      companyId: record?.company?.id ?? null,
      companyName: record?.companyName ?? null,
      status: record && record.status !== 'CONVERTED' ? record.status : 'NEW',
      source: record?.source ?? 'MANUAL',
    },
  });
  const branchId = useWatch({ control, name: 'branchId' });
  const ownerMembershipId = useWatch({ control, name: 'ownerMembershipId' });
  const contactId = useWatch({ control, name: 'contactId' });
  const companyId = useWatch({ control, name: 'companyId' });
  const status = useWatch({ control, name: 'status' });
  const source = useWatch({ control, name: 'source' });
  const submit = async (input: FormData) => {
    try {
      const { status, ...payload } = input;
      if (!canContact || (record && !dirtyFields.contactId)) delete payload.contactId;
      if (!canCompany || (record && !dirtyFields.companyId)) delete payload.companyId;
      // Preserve hidden associations; PATCH contains only relationships the actor can inspect.
      await mutation.mutateAsync(
        record
          ? {
              ...payload,
              status,
              expectedVersion: record.version,
            }
          : payload,
      );
      toast.success(record ? 'Lead atualizado.' : 'Lead criado.');
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
        <RecordField
          field="phone"
          label="Telefone"
          type="tel"
          register={register}
          errors={errors}
        />
        <RecordField
          field="email"
          label="E-mail"
          type="email"
          register={register}
          errors={errors}
        />

        {!record || canAssign ? (
          <AssignmentSelect
            resource="leads"
            kind="branches"
            action={record ? 'update' : 'create'}
            value={branchId}
            label="Filial"
            error={errors.branchId?.message}
            existing={record?.branch}
            onChange={(value) => {
              setValue('branchId', value, { shouldValidate: true });
              setValue('ownerMembershipId', '');
            }}
          />
        ) : (
          <p className="text-body">Filial: {record.branch.name}</p>
        )}
        {!record || canAssign ? (
          <AssignmentSelect
            resource="leads"
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
      <RecordField
        field="companyName"
        label="Nome da empresa prospectada"
        register={register}
        errors={errors}
      />
      {record && (
        <FormField id="record-status" label="Qualificação">
          <Select
            id="record-status"
            label="Qualificação"
            value={status ?? 'NEW'}
            options={[
              { value: 'NEW', label: 'Novo' },
              { value: 'QUALIFIED', label: 'Qualificado' },
              { value: 'DISQUALIFIED', label: 'Desqualificado' },
            ]}
            onValueChange={(value) => {
              const parsed = leadStatusSchema.exclude(['CONVERTED']).safeParse(value);
              if (parsed.success) setValue('status', parsed.data);
            }}
          />
        </FormField>
      )}
      <FormField id="record-source" label="Origem">
        <Select
          id="record-source"
          label="Origem"
          value={source ?? 'MANUAL'}
          options={contactSources.map((source) => ({ value: source, label: sourceLabels[source] }))}
          onValueChange={(value) => {
            const source = contactSources.find((source) => source === value);
            if (source) setValue('source', source);
          }}
        />
      </FormField>
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
          Salvar lead
        </Button>
      </div>
    </form>
  );
}
