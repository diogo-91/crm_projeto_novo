'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setPriceSchema } from '@crm/contracts';
import type { SetPrice, PriceListResponse, PriceItemResponse } from '@crm/contracts';
import { Alert, Button, FormField, Input, Select, toast } from '@crm/ui';
import { RecordField } from '@/features/commercial/record-fields';
import { QueryError } from '@/features/commercial/query-feedback';
import { errorMessage } from '@/lib/api-client';
import { useCatalogMutation, useProductOptions } from './queries';
export function PriceForm({
  list,
  item,
  onSaved,
}: {
  list: PriceListResponse;
  item?: PriceItemResponse;
  onSaved: () => void;
}) {
  const mutation = useCatalogMutation();
  const [search, setSearch] = useState('');
  const products = useProductOptions(search);
  const [productId, setProductId] = useState(item?.product.id ?? '');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SetPrice>({
    resolver: zodResolver(setPriceSchema),
    defaultValues: { unitPrice: item?.unitPrice ?? '', expectedVersion: list.version },
  });
  const submit = async (input: SetPrice) => {
    try {
      await mutation.mutateAsync({
        type: 'price',
        id: list.id,
        productId,
        unitPrice: input.unitPrice,
        version: input.expectedVersion,
      });
      toast.success('Preço salvo.');
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
      {item ? (
        <p className="text-body">
          {item.product.sku} · {item.product.name}
        </p>
      ) : (
        <>
          <FormField id="price-product-search" label="Buscar produto">
            <Input
              id="price-product-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setProductId('');
              }}
            />
          </FormField>
          <FormField id="price-product" label="Produto" required>
            <Select
              id="price-product"
              label="Produto"
              value={productId}
              options={[
                { value: '', label: 'Selecione um produto' },
                ...(products.data?.pages.flatMap((page) => page.data) ?? []).map((product) => ({
                  value: product.id,
                  label: `${product.sku} · ${product.name}`,
                })),
              ]}
              disabled={products.isPending}
              onValueChange={setProductId}
            />
          </FormField>
          {products.isError && (
            <QueryError
              error={products.error}
              retry={() => {
                void products.refetch();
              }}
            />
          )}
          {products.hasNextPage && (
            <Button
              variant="link"
              onClick={() => {
                void products.fetchNextPage();
              }}
            >
              Mais produtos
            </Button>
          )}
        </>
      )}
      <RecordField
        field="unitPrice"
        label="Preço unitário"
        required
        register={register}
        errors={errors}
      />
      <p className="text-caption text-muted">
        {list.currency} · Use ponto decimal e até seis casas decimais.
      </p>
      <Button type="submit" loading={isSubmitting} disabled={!productId}>
        Salvar preço
      </Button>
    </form>
  );
}
