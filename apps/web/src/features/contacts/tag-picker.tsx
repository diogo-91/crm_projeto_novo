'use client';
import { Badge, Button } from '@crm/ui';
import { useTagChoices } from '@/features/commercial/queries';
import { QueryError } from '@/features/commercial/query-feedback';
import type { TagResponse } from '@crm/contracts';
export function TagPicker({
  value,
  onChange,
  existing = [],
}: {
  value: string[];
  onChange: (value: string[]) => void;
  existing?: TagResponse[];
}) {
  const query = useTagChoices();
  const fetched = query.data?.pages.flatMap((page) => page.data) ?? [];
  const rows = [
    ...fetched,
    ...existing.filter((row) => !fetched.some((item) => item.id === row.id)),
  ];
  return (
    <fieldset className="space-y-3">
      <legend className="text-label font-medium">Tags</legend>
      <div className="flex flex-wrap gap-3">
        {rows.map((tag) => (
          <label key={tag.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={value.includes(tag.id)}
              disabled={!tag.active && !value.includes(tag.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked ? [...value, tag.id] : value.filter((id) => id !== tag.id),
                )
              }
            />
            <Badge variant={tag.variant}>
              {tag.name}
              {!tag.active ? ' (inativa)' : ''}
            </Badge>
          </label>
        ))}
      </div>
      {!query.isPending && !rows.length && !query.isError && (
        <p className="text-caption text-muted">Nenhuma tag disponível.</p>
      )}
      {query.isError && (
        <QueryError
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      )}
      {query.hasNextPage && (
        <Button
          type="button"
          variant="link"
          onClick={() => {
            void query.fetchNextPage();
          }}
        >
          Carregar mais tags
        </Button>
      )}
    </fieldset>
  );
}
