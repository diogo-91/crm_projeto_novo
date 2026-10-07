'use client';
import { Input, Select, Button, FormField } from '@crm/ui';
import { AssignmentSelect } from './assignment-fields';
import type { CommercialResource, Filters } from './queries';
export function ListToolbar({
  resource,
  filters,
  search,
  onSearch,
  onFilter,
}: {
  resource: CommercialResource;
  filters: Filters;
  search: string;
  onSearch: (value: string) => void;
  onFilter: (patch: Filters) => void;
}) {
  return (
    <div className="mb-5 grid gap-4 rounded-lg border bg-surface p-5 sm:grid-cols-2 xl:grid-cols-4">
      <FormField id={`${resource}-search`} label="Buscar">
        <Input
          id={`${resource}-search`}
          type="search"
          value={search}
          placeholder={
            resource === 'tasks' ? 'Título ou descrição' : 'Nome, telefone, e-mail ou documento'
          }
          onChange={(event) => onSearch(event.target.value)}
        />
      </FormField>
      <AssignmentSelect
        resource={resource}
        kind="branches"
        action="read"
        value={filters['branchId'] ?? ''}
        label="Filtrar por filial"
        onChange={(value) => onFilter({ branchId: value, ownerMembershipId: '' })}
      />
      <AssignmentSelect
        resource={resource}
        kind="owners"
        action="read"
        branchId={filters['branchId'] ?? ''}
        value={filters['ownerMembershipId'] ?? ''}
        label="Filtrar por responsável"
        onChange={(value) => onFilter({ ownerMembershipId: value })}
      />
      <FormField id={`${resource}-status`} label="Status">
        <Select
          id={`${resource}-status`}
          label="Status"
          value={filters['active'] ?? ''}
          onValueChange={(value) => onFilter({ active: value })}
          options={[
            { value: '', label: 'Todos' },
            { value: 'true', label: 'Ativos' },
            { value: 'false', label: 'Inativos' },
          ]}
        />
      </FormField>
      <FormField id={`${resource}-sort`} label="Ordenar">
        <Select
          id={`${resource}-sort`}
          label="Ordenar"
          value={filters['sort'] ?? 'createdAt'}
          onValueChange={(value) => onFilter({ sort: value })}
          options={[
            { value: 'createdAt', label: 'Cadastro' },
            { value: 'updatedAt', label: 'Atualização' },
            { value: 'name', label: 'Nome' },
          ]}
        />
      </FormField>
      <FormField id={`${resource}-direction`} label="Direção">
        <Select
          id={`${resource}-direction`}
          label="Direção"
          value={filters['direction'] ?? 'desc'}
          onValueChange={(value) => onFilter({ direction: value })}
          options={[
            { value: 'desc', label: 'Decrescente' },
            { value: 'asc', label: 'Crescente' },
          ]}
        />
      </FormField>
      <FormField id={`${resource}-limit`} label="Registros por página">
        <Select
          id={`${resource}-limit`}
          label="Registros por página"
          value={filters['limit'] ?? '25'}
          onValueChange={(value) => onFilter({ limit: value })}
          options={['10', '25', '50', '100'].map((value) => ({ value, label: value }))}
        />
      </FormField>
      <div className="flex items-end">
        <Button
          variant="ghost"
          onClick={() => {
            onSearch('');
            onFilter(Object.fromEntries(Object.keys(filters).map((key) => [key, ''])));
          }}
        >
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
