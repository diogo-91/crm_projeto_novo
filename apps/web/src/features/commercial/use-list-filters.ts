'use client';
import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Filters } from './queries';
export function useListFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const text = params.toString();
  const filters: Filters = Object.fromEntries(params.entries());
  const urlSearch = params.get('search') ?? '';
  const [draft, setDraft] = useState({ urlSearch, value: urlSearch });
  if (draft.urlSearch !== urlSearch) setDraft({ urlSearch, value: urlSearch });
  const search = draft.urlSearch === urlSearch ? draft.value : urlSearch;
  const setSearch = (value: string) => setDraft({ urlSearch, value });
  const update = useCallback(
    (patch: Filters) => {
      const next = new URLSearchParams(text);
      next.delete('cursor');
      next.delete('previous');
      for (const [name, value] of Object.entries(patch)) {
        if (value) next.set(name, value);
        else next.delete(name);
      }
      router.replace(`${path}${next.size ? '?' + next.toString() : ''}`, { scroll: false });
    },
    [text, path, router],
  );
  useEffect(() => {
    if (search === (new URLSearchParams(text).get('search') ?? '')) return;
    const timeout = setTimeout(() => update({ search }), 350);
    return () => clearTimeout(timeout);
  }, [search, text, update]);
  const next = (cursor: string | null) => {
    if (!cursor) return;
    const p = new URLSearchParams(text);
    p.append('previous', p.get('cursor') ?? '');
    p.set('cursor', cursor);
    router.push(`${path}?${p.toString()}`, { scroll: false });
  };
  const previous = () => {
    const p = new URLSearchParams(text);
    const stack = p.getAll('previous');
    const cursor = stack.pop();
    if (cursor === undefined) return;
    p.delete('previous');
    for (const item of stack) p.append('previous', item);
    if (cursor) p.set('cursor', cursor);
    else p.delete('cursor');
    router.push(`${path}${p.size ? '?' + p.toString() : ''}`, { scroll: false });
  };
  delete filters['previous'];
  return {
    filters,
    search,
    setSearch,
    update,
    next,
    previous,
    hasPrevious: params.getAll('previous').length > 0,
  };
}
