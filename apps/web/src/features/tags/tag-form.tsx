'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { createTagSchema, tagVariantSchema } from '@crm/contracts';
import type { CreateTag, TagResponse } from '@crm/contracts';
import { Alert, Button, FormField, Select, toast } from '@crm/ui';
import { RecordField } from '@/features/commercial/record-fields';
import { useSaveTag } from '@/features/commercial/queries';
import { ApiError, errorMessage } from '@/lib/api-client';
export function TagForm({ record, onSaved }: { record?: TagResponse; onSaved: () => void }) {
  const mutation = useSaveTag(record?.id);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createTagSchema>, unknown, CreateTag>({
    resolver: zodResolver(createTagSchema),
    defaultValues: { name: record?.name ?? '', variant: record?.variant ?? 'neutral' },
  });
  const variant = useWatch({ control, name: 'variant' });
  const submit = async (input: CreateTag) => {
    try {
      await mutation.mutateAsync(record ? { ...input, expectedVersion: record.version } : input);
      toast.success(record ? 'Tag atualizada.' : 'Tag criada.');
      onSaved();
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError && error.status === 409
            ? 'Já existe uma tag com este nome, ou ela foi alterada.'
            : errorMessage(error),
      });
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
      <RecordField field="name" label="Nome" required register={register} errors={errors} />
      <FormField id="tag-variant" label="Aparência">
        <Select
          id="tag-variant"
          label="Aparência"
          value={variant ?? 'neutral'}
          options={tagVariantSchema.options.map((value) => ({
            value,
            label: {
              neutral: 'Neutra',
              primary: 'Destaque',
              success: 'Verde',
              warning: 'Amarelo',
              danger: 'Vermelho',
              info: 'Azul',
            }[value],
          }))}
          onValueChange={(value) => {
            const variant = tagVariantSchema.parse(value);
            setValue('variant', variant);
          }}
        />
      </FormField>
      <Button type="submit" loading={isSubmitting}>
        Salvar tag
      </Button>
    </form>
  );
}
