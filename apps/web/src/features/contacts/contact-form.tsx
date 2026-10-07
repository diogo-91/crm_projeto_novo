'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createContactSchema, contactSources } from '@crm/contracts';
import type { ContactResponse, CreateContact } from '@crm/contracts';
import type { z } from 'zod';
import { Alert, Button, FormField, Select, toast } from '@crm/ui';
import { useSaveContact, useCommercialContext } from '@/features/commercial/queries';
import { RecordField } from '@/features/commercial/record-fields';
import { AssignmentSelect } from '@/features/commercial/assignment-fields';
import { CompanyPicker } from '@/features/commercial/company-picker';
import { TagPicker } from './tag-picker';
import { usePermission } from '@/features/auth/auth-provider';
import { ApiError, errorMessage } from '@/lib/api-client';
import { sourceLabels } from '@/features/commercial/source-labels';
type Input = z.input<typeof createContactSchema>;
export function ContactForm({
  record,
  onSaved,
}: {
  record?: ContactResponse;
  onSaved: () => void;
}) {
  const { context } = useCommercialContext();
  const mutation = useSaveContact(record?.id);
  const canAssign = usePermission('contacts.assign');
  const canCompany = usePermission('companies.read');
  const canTags = usePermission('tags.read');
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Input, unknown, CreateContact>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      name: record?.name ?? '',
      phone: record?.phone ?? '',
      email: record?.email ?? null,
      document: record?.document ?? null,
      notes: record?.notes ?? null,
      branchId: record?.branch.id ?? context.primaryBranchId ?? '',
      ownerMembershipId: record?.owner.id ?? context.membershipId,
      companyId: record?.company?.id ?? null,
      source: record?.source ?? 'MANUAL',
      tagIds: record?.tags.map((tag) => tag.id) ?? [],
    },
  });
  const branchId = useWatch({ control, name: 'branchId' });
  const ownerMembershipId = useWatch({ control, name: 'ownerMembershipId' });
  const companyId = useWatch({ control, name: 'companyId' });
  const source = useWatch({ control, name: 'source' });
  const tagIds = useWatch({ control, name: 'tagIds' });
  const submit = async (input: CreateContact) => {
    try {
      const payload = { ...input };
      if (!canCompany || (record && !dirtyFields.companyId)) delete payload.companyId;
      // Preserve hidden associations; PATCH contains only relationships the actor can inspect.
      await mutation.mutateAsync(
        record
          ? {
              ...payload,
              ...(!canTags || (record && !dirtyFields.tagIds) ? { tagIds: undefined } : {}),
              expectedVersion: record.version,
            }
          : payload,
      );
      toast.success(record ? 'Cliente atualizado.' : 'Cliente criado.');
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        setError('root', {
          message:
            'Já existe um registro com este telefone ou documento, ou ele foi alterado. Recarregue e confira os dados.',
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
          required
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
        <RecordField field="document" label="Documento" register={register} errors={errors} />
        {!record || canAssign ? (
          <AssignmentSelect
            resource="contacts"
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
            resource="contacts"
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
      {canCompany && (
        <CompanyPicker
          value={companyId ?? ''}
          existing={record?.company}
          onChange={(value) => setValue('companyId', value || null, { shouldDirty: true })}
        />
      )}
      {canTags && (
        <TagPicker
          value={tagIds ?? []}
          existing={record?.tags ?? []}
          onChange={(value) =>
            setValue('tagIds', value, { shouldValidate: true, shouldDirty: true })
          }
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
          Salvar cliente
        </Button>
      </div>
    </form>
  );
}
