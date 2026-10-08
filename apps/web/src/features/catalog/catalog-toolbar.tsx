'use client';
import Link from 'next/link';
import { Input, FormField, Select } from '@crm/ui';
import type { Filters } from '@/features/commercial/queries';
export function CatalogLinks() {
  return (
    <nav aria-label="Catálogo" className="mb-6 flex flex-wrap gap-5 text-body">
      <Link className="hover:underline" href="/products">
        Produtos
      </Link>
      <Link className="hover:underline" href="/products/price-lists">
        Tabelas de preços
      </Link>
    </nav>
  );
}
export function CatalogToolbar({
  filters,
  search,
  onSearch,
  onFilter,
}: {
  filters: Filters;
  search: string;
  onSearch: (s: string) => void;
  onFilter: (f: Filters) => void;
}) {
  return (
    <div className="mb-5 grid gap-4 md:grid-cols-4">
      <FormField id="catalog-search" label="Buscar no catálogo">
        <Input
          id="catalog-search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Nome ou SKU"
        />
      </FormField>
      <FormField id="catalog-status" label="Status">
        <Select
          id="catalog-status"
          label="Status"
          value={filters['active'] ?? ''}
          options={[
            { value: '', label: 'Todos' },
            { value: 'true', label: 'Ativos' },
            { value: 'false', label: 'Arquivados' },
          ]}
          onValueChange={(active) => onFilter({ active })}
        />
      </FormField>
      <FormField id="catalog-sort" label="Ordenar por">
        <Select
          id="catalog-sort"
          label="Ordenar por"
          value={filters['sort'] ?? 'createdAt'}
          options={[
            { value: 'createdAt', label: 'Criação' },
            { value: 'updatedAt', label: 'Atualização' },
            { value: 'name', label: 'Nome' },
          ]}
          onValueChange={(sort) => onFilter({ sort })}
        />
      </FormField>
      <FormField id="catalog-direction" label="Ordem">
        <Select
          id="catalog-direction"
          label="Ordem"
          value={filters['direction'] ?? 'desc'}
          options={[
            { value: 'desc', label: 'Decrescente' },
            { value: 'asc', label: 'Crescente' },
          ]}
          onValueChange={(direction) => onFilter({ direction })}
        />
      </FormField>
    </div>
  );
}
