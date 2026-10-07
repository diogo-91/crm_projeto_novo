'use client';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  contactListResponseSchema,
  leadListResponseSchema,
  opportunityListResponseSchema,
} from '@crm/contracts';
import type { ResourceTarget } from '@crm/contracts';
import { Input, Select, Button, FormField, Alert } from '@crm/ui';
import { useCommercialContext, queryString } from '@/features/commercial/queries';
import { errorMessage } from '@/lib/api-client';
export function TargetPicker({
  value,
  onChange,
}: {
  value: ResourceTarget | null;
  onChange: (value: ResourceTarget | null) => void;
}) {
  const [type, setType] = useState<ResourceTarget['type']>(value?.type ?? 'contact');
  const [search, setSearch] = useState('');
  const { session, root, context } = useCommercialContext();
  const resource = type === 'contact' ? 'contacts' : type === 'lead' ? 'leads' : 'opportunities';
  const choices = useInfiniteQuery({
    queryKey: [...root, 'task-targets', type, search],
    initialPageParam: '',
    queryFn: async ({ pageParam, signal }) => {
      const path = `${resource}?${queryString({ active: 'true', search, cursor: pageParam, limit: '25' })}`;
      const page =
        type === 'contact'
          ? await session.request(path, contactListResponseSchema, { signal })
          : type === 'lead'
            ? await session.request(path, leadListResponseSchema, { signal })
            : await session.request(path, opportunityListResponseSchema, { signal });
      return {
        data: page.data.map((row) => ({ id: row.id, name: row.name })),
        pageInfo: page.pageInfo,
      };
    },
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    enabled: context.permissions.includes(`${resource}.read`),
  });
  const options =
    choices.data?.pages.flatMap((p) => p.data).map((row) => ({ value: row.id, label: row.name })) ??
    [];
  if (value?.type === type && !options.some((o) => o.value === value.id))
    options.unshift({ value: value.id, label: 'Registro vinculado' });
  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-1 text-body font-medium">Vínculo opcional</legend>
      <FormField id="task-target-type" label="Tipo de registro">
        <Select
          id="task-target-type"
          label="Tipo de registro"
          value={type}
          onValueChange={(v) => {
            if (v === 'contact' || v === 'lead' || v === 'opportunity') {
              setType(v);
              onChange(null);
              setSearch('');
            }
          }}
          options={[
            { value: 'contact', label: 'Cliente' },
            { value: 'lead', label: 'Lead' },
            { value: 'opportunity', label: 'Oportunidade' },
          ]}
        />
      </FormField>
      <FormField id="task-target-search" label="Buscar registro">
        <Input id="task-target-search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </FormField>
      <FormField id="task-target-record" label="Registro">
        <Select
          id="task-target-record"
          label="Registro"
          value={value?.type === type ? value.id : ''}
          options={[{ value: '', label: 'Sem vínculo' }, ...options]}
          onValueChange={(id) => onChange(id ? { type, id } : null)}
        />
      </FormField>
      {choices.isError && <Alert>{errorMessage(choices.error)}</Alert>}
      {choices.hasNextPage && (
        <Button
          type="button"
          variant="link"
          onClick={() => {
            void choices.fetchNextPage();
          }}
        >
          Carregar mais registros
        </Button>
      )}
    </fieldset>
  );
}
