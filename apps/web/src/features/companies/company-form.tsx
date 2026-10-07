'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCompanySchema } from '@crm/contracts';
import type { CompanyResponse, CreateCompany } from '@crm/contracts';
import { Alert, Button, toast } from '@crm/ui';
import { RecordField } from '@/features/commercial/record-fields';
import { AssignmentSelect } from '@/features/commercial/assignment-fields';
import { useSaveCompany, useCommercialContext } from '@/features/commercial/queries';
import { usePermission } from '@/features/auth/auth-provider';
import { ApiError, errorMessage } from '@/lib/api-client';
export function CompanyForm({
  record,
  onSaved,
}: {
  record?: CompanyResponse;
  onSaved: () => void;
}) {
  const { context } = useCommercialContext();
  const mutation = useSaveCompany(record?.id);
  const canAssign = usePermission('companies.assign');
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompany>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: record?.name ?? '',
      legalName: record?.legalName ?? null,
      phone: record?.phone ?? null,
      email: record?.email ?? null,
      document: record?.document ?? null,
      notes: record?.notes ?? null,
      branchId: record?.branch.id ?? context.primaryBranchId ?? '',
      ownerMembershipId: record?.owner.id ?? context.membershipId,
    },
  });
  const branchId = useWatch({ control, name: 'branchId' });
  const ownerMembershipId = useWatch({ control, name: 'ownerMembershipId' });
  const submit = async (input: CreateCompany) => {
    try {
      await mutation.mutateAsync(record ? { ...input, expectedVersion: record.version } : input);
      toast.success(record ? 'Empresa atualizada.' : 'Empresa criada.');
      onSaved();
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError && error.status === 409
            ? 'Já existe uma empresa com este documento, ou o registro foi alterado. Recarregue e confira os dados.'
            : errorMessage(error),
      });
    }
  };
  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
    >
      {errors.root?.message && <Alert>{errors.root.message}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <RecordField field="name" label="Nome" required register={register} errors={errors} />
        <RecordField field="legalName" label="Razão social" register={register} errors={errors} />
        <RecordField field="document" label="Documento" register={register} errors={errors} />
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
            resource="companies"
            kind="branches"
            action={record ? 'update' : 'create'}
            value={branchId}
            label="Filial"
            existing={record?.branch}
            error={errors.branchId?.message}
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
            resource="companies"
            kind="owners"
            action={record ? 'update' : 'create'}
            branchId={branchId}
            value={ownerMembershipId ?? ''}
            label="Responsável"
            existing={record?.owner}
            error={errors.ownerMembershipId?.message}
            onChange={(value) => setValue('ownerMembershipId', value, { shouldValidate: true })}
          />
        ) : (
          <p className="text-body">Responsável: {record.owner.name}</p>
        )}
      </div>
      <RecordField
        field="notes"
        label="Observações"
        multiline
        register={register}
        errors={errors}
      />
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Salvar empresa
        </Button>
      </div>
    </form>
  );
}
