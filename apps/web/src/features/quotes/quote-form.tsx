'use client';
import { useRef, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { createQuoteSchema } from '@crm/contracts';
import type { CreateQuote, QuoteResponse, OpportunityResponse } from '@crm/contracts';
import { Alert, Button, FormField, Select, Input, toast } from '@crm/ui';
import { RecordField } from '@/features/commercial/record-fields';
import { QueryError } from '@/features/commercial/query-feedback';
import { ContactPicker } from '@/features/sales/contact-picker';
import { CompanyPicker } from '@/features/commercial/company-picker';
import { usePriceLists, usePrices } from '@/features/catalog/queries';
import { errorMessage } from '@/lib/api-client';
import { useQuoteBranches, useQuoteMutation } from './queries';
export function QuoteForm({
  record,
  opportunity,
  onSaved,
}: {
  record?: QuoteResponse;
  opportunity?: OpportunityResponse;
  onSaved: (record: QuoteResponse) => void;
}) {
  const mutation = useQuoteMutation(),
    branches = useQuoteBranches();
  const [chosenProducts, setChosenProducts] = useState<{ value: string; label: string }[]>([]);
  const intent = useRef<{ body: string; key: string } | null>(null);
  const [listCursor, setListCursor] = useState(''),
    [priceCursor, setPriceCursor] = useState('');
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createQuoteSchema>, unknown, CreateQuote>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      name: record?.name ?? (opportunity ? `Proposta — ${opportunity.name}` : ''),
      branchId: record?.branchId ?? opportunity?.branch.id ?? '',
      contactId: record?.contactId ?? opportunity?.contact?.id ?? null,
      companyId:
        record?.companyId ?? (!opportunity?.contact ? opportunity?.company?.id : null) ?? null,
      opportunityId: record?.opportunityId ?? opportunity?.id ?? null,
      priceListId: record?.priceListId ?? '',
      notes: record?.notes ?? null,
      validUntil: record?.validUntil ?? null,
      items: record?.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        discountPercent: item.discountPercent,
      })) ?? [{ productId: '', quantity: '1', discountPercent: '0' }],
    },
  });
  const fields = useFieldArray({ control, name: 'items' });
  const [branchId, listId, contactId, companyId] = useWatch({
    control,
    name: ['branchId', 'priceListId', 'contactId', 'companyId'],
  });
  const lists = usePriceLists({ active: 'true', branchId, cursor: listCursor, limit: '100' });
  const prices = usePrices(listId, { active: 'true', cursor: priceCursor, limit: '100' });
  const submit = async (input: CreateQuote) => {
    try {
      const body = JSON.stringify(input);
      if (!intent.current || intent.current.body !== body)
        intent.current = { body, key: crypto.randomUUID() };
      const result = await mutation.mutateAsync(
        record
          ? {
              type: 'update',
              id: record.id,
              input: {
                items: input.items,
                notes: input.notes,
                validUntil: input.validUntil,
                expectedVersion: record.version,
              },
            }
          : { type: 'create', input, key: intent.current.key },
      );
      toast.success('Orçamento salvo.');
      onSaved(result);
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
      {!record && (
        <>
          <RecordField
            field="name"
            label="Nome do orçamento"
            required
            register={register}
            errors={errors}
          />
          <FormField id="quote-branch" label="Filial" required error={errors.branchId?.message}>
            <Select
              id="quote-branch"
              label="Filial"
              value={branchId}
              disabled={Boolean(opportunity) || branches.isPending}
              options={[
                { value: '', label: 'Selecione a filial' },
                ...(branches.data?.pages.flatMap((page) => page.data) ?? []).map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                })),
              ]}
              onValueChange={(value) => {
                setValue('branchId', value);
                setValue('priceListId', '');
                fields.replace([{ productId: '', quantity: '1', discountPercent: '0' }]);
                setChosenProducts([]);
                setPriceCursor('');
                setListCursor('');
              }}
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
              type="button"
              variant="link"
              onClick={() => {
                void branches.fetchNextPage();
              }}
            >
              Mais filiais
            </Button>
          )}
          {opportunity ? (
            <p className="text-body">
              Oportunidade: {opportunity.name} · Comprador:{' '}
              {opportunity.contact?.name ?? opportunity.company?.name}
            </p>
          ) : (
            <>
              <ContactPicker
                value={contactId ?? ''}
                onChange={(value) => {
                  setValue('contactId', value || null);
                  if (value) setValue('companyId', null);
                }}
              />
              <CompanyPicker
                value={companyId ?? ''}
                onChange={(value) => {
                  setValue('companyId', value || null);
                  if (value) setValue('contactId', null);
                }}
              />
            </>
          )}
          <FormField
            id="quote-list"
            label="Tabela de preços"
            required
            error={errors.priceListId?.message}
          >
            <Select
              id="quote-list"
              label="Tabela de preços"
              value={listId}
              disabled={!branchId || lists.isPending}
              options={[
                { value: '', label: 'Selecione a tabela' },
                ...(lists.data?.data ?? []).map((list) => ({
                  value: list.id,
                  label: `${list.name} · ${list.currency}`,
                })),
              ]}
              onValueChange={(value) => {
                setValue('priceListId', value);
                setChosenProducts([]);
                fields.replace([{ productId: '', quantity: '1', discountPercent: '0' }]);
                setPriceCursor('');
              }}
            />
          </FormField>
          {lists.isError && (
            <QueryError
              error={lists.error}
              retry={() => {
                void lists.refetch();
              }}
            />
          )}
          {lists.data?.pageInfo.hasNextPage && (
            <Button
              type="button"
              variant="link"
              onClick={() => setListCursor(lists.data?.pageInfo.nextCursor ?? '')}
            >
              Próximas tabelas
            </Button>
          )}
          {listCursor && (
            <Button type="button" variant="link" onClick={() => setListCursor('')}>
              Primeiras tabelas
            </Button>
          )}
        </>
      )}
      {record && (
        <p className="text-body">
          {record.buyer.name} · {record.priceListName} · {record.currency}. Itens existentes
          preservam seus preços.
        </p>
      )}
      {errors.contactId?.message && <Alert>{errors.contactId.message}</Alert>}
      <p className="text-caption text-muted">
        Selecione um comprador. Use ponto decimal; desconto percentual de 0 a 100. Totais calculados
        pelo servidor ao salvar.
      </p>
      {fields.fields.map((field, index) => {
        const options = (prices.data?.data ?? []).map((item) => ({
          value: item.product.id,
          label: `${item.product.sku} · ${item.product.name} · ${item.unitPrice}`,
        }));
        for (const chosen of chosenProducts)
          if (!options.some((option) => option.value === chosen.value)) options.unshift(chosen);
        for (const item of record?.items ?? []) {
          const existing = options.find((option) => option.value === item.productId);
          const snapshot = `${item.sku} · ${item.description} · ${item.unitPrice} (snapshot)`;
          if (existing) existing.label = snapshot;
          else options.unshift({ value: item.productId, label: snapshot });
        }
        return (
          <fieldset key={field.id} className="space-y-3 rounded-lg border p-4">
            <legend className="px-2 text-body font-semibold">Item {index + 1}</legend>
            <FormField
              id={`quote-product-${index}`}
              label={`Produto ${index + 1}`}
              required
              error={errors.items?.[index]?.productId?.message}
            >
              <select
                id={`quote-product-${index}`}
                aria-invalid={Boolean(errors.items?.[index]?.productId)}
                aria-describedby={
                  errors.items?.[index]?.productId ? `quote-product-${index}-error` : undefined
                }
                className="h-10 w-full rounded-md border bg-surface px-3 text-body"
                {...register(`items.${index}.productId`, {
                  onChange: (event: { target: { value: string } }) => {
                    const option = options.find((item) => item.value === event.target.value);
                    if (option)
                      setChosenProducts((current) => [
                        ...current.filter((item) => item.value !== option.value),
                        option,
                      ]);
                  },
                })}
              >
                <option value="">Selecione o produto</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                id={`quote-qty-${index}`}
                label={`Quantidade ${index + 1}`}
                required
                error={errors.items?.[index]?.quantity?.message}
              >
                <Input
                  id={`quote-qty-${index}`}
                  aria-invalid={Boolean(errors.items?.[index]?.quantity)}
                  aria-describedby={
                    errors.items?.[index]?.quantity ? `quote-qty-${index}-error` : undefined
                  }
                  inputMode="decimal"
                  {...register(`items.${index}.quantity`)}
                />
              </FormField>
              <FormField
                id={`quote-discount-${index}`}
                label={`Desconto % ${index + 1}`}
                required
                error={errors.items?.[index]?.discountPercent?.message}
              >
                <Input
                  id={`quote-discount-${index}`}
                  aria-invalid={Boolean(errors.items?.[index]?.discountPercent)}
                  aria-describedby={
                    errors.items?.[index]?.discountPercent
                      ? `quote-discount-${index}-error`
                      : undefined
                  }
                  inputMode="decimal"
                  {...register(`items.${index}.discountPercent`)}
                />
              </FormField>
            </div>
            {fields.fields.length > 1 && (
              <Button type="button" variant="secondary" onClick={() => fields.remove(index)}>
                Remover item {index + 1}
              </Button>
            )}
          </fieldset>
        );
      })}
      {errors.items?.message && <Alert>{errors.items.message}</Alert>}
      {prices.isError && listId && (
        <QueryError
          error={prices.error}
          retry={() => {
            void prices.refetch();
          }}
        />
      )}
      {prices.data?.pageInfo.hasNextPage && (
        <Button
          type="button"
          variant="link"
          onClick={() => setPriceCursor(prices.data?.pageInfo.nextCursor ?? '')}
        >
          Próximos produtos da tabela
        </Button>
      )}
      {priceCursor && (
        <Button type="button" variant="link" onClick={() => setPriceCursor('')}>
          Primeiros produtos da tabela
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={fields.fields.length >= 100 || !listId}
        onClick={() => fields.append({ productId: '', quantity: '1', discountPercent: '0' })}
      >
        Adicionar item
      </Button>
      <RecordField
        field="validUntil"
        label="Válido até (dia UTC)"
        type="date"
        register={register}
        errors={errors}
      />
      <RecordField
        field="notes"
        label="Condições e observações"
        multiline
        register={register}
        errors={errors}
      />
      <Button type="submit" loading={isSubmitting}>
        Salvar orçamento
      </Button>
    </form>
  );
}
