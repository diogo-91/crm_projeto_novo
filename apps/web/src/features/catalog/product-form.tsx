'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProductSchema } from '@crm/contracts';
import type { CreateProduct, ProductResponse } from '@crm/contracts';
import type { z } from 'zod';
import { Alert, Button, toast } from '@crm/ui';
import { RecordField } from '@/features/commercial/record-fields';
import { errorMessage } from '@/lib/api-client';
import { useCatalogMutation } from './queries';
export function ProductForm({
  record,
  onSaved,
}: {
  record?: ProductResponse;
  onSaved: () => void;
}) {
  const mutation = useCatalogMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createProductSchema>, unknown, CreateProduct>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: record?.name ?? '',
      sku: record?.sku ?? '',
      unit: record?.unit ?? 'UN',
      description: record?.description ?? null,
    },
  });
  const submit = async (input: CreateProduct) => {
    try {
      await mutation.mutateAsync({
        type: 'product',
        ...(record ? { id: record.id } : {}),
        input: record
          ? {
              name: input.name,
              sku: input.sku,
              description: input.description,
              expectedVersion: record.version,
            }
          : input,
      });
      toast.success('Produto salvo.');
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
        label="Nome do produto"
        required
        register={register}
        errors={errors}
      />
      <RecordField field="sku" label="SKU" required register={register} errors={errors} />
      {record ? (
        <p className="text-body">Unidade: {record.unit} (fixa)</p>
      ) : (
        <RecordField field="unit" label="Unidade" required register={register} errors={errors} />
      )}
      <RecordField
        field="description"
        label="Descrição"
        multiline
        register={register}
        errors={errors}
      />
      <Button type="submit" loading={isSubmitting}>
        Salvar produto
      </Button>
    </form>
  );
}
