'use client';
import { Button, Select, Alert, FormField } from '@crm/ui';
import { useAssignment } from './queries';
import type { CommercialResource } from './queries';
import { errorMessage } from '@/lib/api-client';
export function AssignmentSelect({
  resource,
  kind,
  action,
  branchId = '',
  value,
  onChange,
  label,
  error,
  existing,
}: {
  resource: CommercialResource;
  kind: 'branches' | 'owners';
  action: 'create' | 'update' | 'read';
  branchId?: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  error?: string | undefined;
  existing?: { id: string; name: string } | undefined;
}) {
  const query = useAssignment(resource, kind, action, branchId);
  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const options = rows.map((row) => ({ value: row.id, label: row.name }));
  if (existing && existing.id === value && !rows.some((row) => row.id === existing.id))
    options.unshift({ value: existing.id, label: existing.name });
  const id = `${resource}-${kind}-${action}`;
  return (
    <FormField id={id} label={label} error={error} required={action !== 'read'}>
      <Select
        id={id}
        label={label}
        value={value}
        onValueChange={onChange}
        options={action === 'read' ? [{ value: '', label: 'Todos' }, ...options] : options}
        disabled={query.isPending || (kind === 'owners' && !branchId)}
        invalid={Boolean(error)}
        describedBy={error ? `${id}-error` : undefined}
      />
      {query.isError && (
        <Alert>
          {errorMessage(query.error)}{' '}
          <Button
            type="button"
            variant="link"
            onClick={() => {
              void query.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </Alert>
      )}
      {query.hasNextPage && (
        <Button
          type="button"
          variant="link"
          loading={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
          }}
        >
          Carregar mais {kind === 'branches' ? 'filiais' : 'responsáveis'}
        </Button>
      )}
    </FormField>
  );
}
