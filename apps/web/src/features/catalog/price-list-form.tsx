'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPriceListSchema, updatePriceListSchema, currencySchema } from '@crm/contracts';
import type { CreatePriceList, UpdatePriceList, PriceListResponse } from '@crm/contracts';
import { Alert, Button, FormField, Select, toast } from '@crm/ui';
import { RecordField } from '@/features/commercial/record-fields';
import { QueryError } from '@/features/commercial/query-feedback';
import { errorMessage } from '@/lib/api-client';
import { useCatalogMutation, usePriceBranches } from './queries';
export function PriceListCreateForm({ onSaved }: { onSaved: () => void }) {
  const mutation = useCatalogMutation();
  const branches = usePriceBranches();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreatePriceList>({
    resolver: zodResolver(createPriceListSchema),
    defaultValues: { name: '', currency: 'BRL', branchId: null },
  });
  const currency = useWatch({ control, name: 'currency' });
  const branchId = useWatch({ control, name: 'branchId' });
  const submit = async (input: CreatePriceList) => {
    try {
      await mutation.mutateAsync({ type: 'list', input });
      toast.success('Tabela criada.');
      onSaved();
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  };
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        void handleSubmit(submit)(e);
      }}
    >
      {errors.root?.message && <Alert>{errors.root.message}</Alert>}
      <RecordField
        field="name"
        label="Nome da tabela"
        required
        register={register}
        errors={errors}
      />
      <FormField id="price-currency" label="Moeda">
        <Select
          id="price-currency"
          label="Moeda"
          value={currency}
          options={currencySchema.options.map((value) => ({ value, label: value }))}
          onValueChange={(value) => setValue('currency', currencySchema.parse(value))}
        />
      </FormField>
      <FormField id="price-branch" label="Disponível para" error={errors.branchId?.message}>
        <Select
          id="price-branch"
          label="Disponível para"
          value={branchId ?? ''}
          options={[
            {
              value: '',
              label: branches.data?.pages[0]?.organizationAllowed
                ? 'Toda a organização'
                : 'Selecione uma filial',
            },
            ...(branches.data?.pages.flatMap((page) => page.data) ?? []).map((branch) => ({
              value: branch.id,
              label: branch.name,
            })),
          ]}
          disabled={branches.isPending}
          onValueChange={(value) => setValue('branchId', value || null)}
        />
      </FormField>
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
      <p className="text-caption text-muted">
        Moeda e filial não poderão ser alteradas depois da criação.
      </p>
      <Button
        type="submit"
        loading={isSubmitting}
        disabled={
          branches.isPending ||
          branches.isError ||
          (!branchId && !branches.data?.pages[0]?.organizationAllowed)
        }
      >
        Salvar tabela
      </Button>
    </form>
  );
}
export function PriceListEditForm({
  record,
  onSaved,
}: {
  record: PriceListResponse;
  onSaved: () => void;
}) {
  const mutation = useCatalogMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePriceList>({
    resolver: zodResolver(updatePriceListSchema),
    defaultValues: { name: record.name, expectedVersion: record.version },
  });
  const submit = async (input: UpdatePriceList) => {
    try {
      await mutation.mutateAsync({ type: 'list', id: record.id, input });
      toast.success('Tabela salva.');
      onSaved();
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  };
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        void handleSubmit(submit)(e);
      }}
    >
      {errors.root?.message && <Alert>{errors.root.message}</Alert>}
      <RecordField
        field="name"
        label="Nome da tabela"
        required
        register={register}
        errors={errors}
      />
      <Button type="submit" loading={isSubmitting}>
        Salvar tabela
      </Button>
    </form>
  );
}
