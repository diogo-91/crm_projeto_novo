'use client';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useState } from 'react';
import { Select, Button, Input, FormField } from '@crm/ui';
import { useContacts } from '@/features/commercial/queries';
import { QueryError } from '@/features/commercial/query-feedback';
export function ContactPicker({
  value,
  onChange,
  existing,
  emptyLabel = 'Sem cliente',
}: {
  value: string;
  onChange: (value: string) => void;
  existing?: { id: string; name: string } | null | undefined;
  emptyLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState('');
  const [selected, setSelected] = useState<{ value: string; label: string } | null>(null);
  const settled = useDebouncedValue(search);
  const query = useContacts({ search: settled, cursor, active: 'true', limit: '100' });
  const options = (query.data?.data ?? []).map((row) => ({ value: row.id, label: row.name }));
  if (existing && existing.id === value && !options.some((option) => option.value === value))
    options.unshift({ value: existing.id, label: existing.name });
  if (value && !options.some((option) => option.value === value))
    options.unshift(selected?.value === value ? selected : { value, label: 'Cliente selecionada' });
  return (
    <FormField id="record-contact" label="Cliente">
      <Input
        aria-label="Buscar cliente para associação"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setCursor('');
        }}
        placeholder="Pesquisar cliente"
      />
      <Select
        id="record-contact"
        label="Cliente"
        value={value}
        onValueChange={(next) => {
          setSelected(options.find((option) => option.value === next) ?? null);
          onChange(next);
        }}
        options={[{ value: '', label: emptyLabel }, ...options]}
        disabled={query.isPending}
      />
      {query.isError && (
        <QueryError
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      )}
      {cursor && (
        <Button type="button" variant="link" onClick={() => setCursor('')}>
          Primeiros clientes
        </Button>
      )}
      {query.data?.pageInfo.hasNextPage && (
        <Button
          type="button"
          variant="link"
          onClick={() => setCursor(query.data?.pageInfo.nextCursor ?? '')}
        >
          Próximos clientes
        </Button>
      )}
    </FormField>
  );
}
