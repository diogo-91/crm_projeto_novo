'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Badge, EmptyState } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { RecordSummary } from '@/features/commercial/record-summary';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { QueryError, ListSkeleton } from '@/features/commercial/query-feedback';
import { usePermission } from '@/features/auth/auth-provider';
import { ProductForm } from './product-form';
import { CatalogArchive } from './catalog-archive';
import { useProduct } from './queries';
export function ProductDetail({ id }: { id: string }) {
  const query = useProduct(id);
  const [editing, setEditing] = useState(false);
  const read = usePermission('products.read');
  const manage = usePermission('products.manage');
  if (!read)
    return (
      <EmptyState
        title="Acesso negado"
        description="Você não possui permissão para consultar produtos."
      />
    );
  if (query.isPending) return <ListSkeleton />;
  if (query.isError)
    return (
      <QueryError
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const row = query.data;
  return (
    <>
      <PageHeader
        title={row.name}
        description="Ficha do produto"
        breadcrumb={
          <Link className="mb-3 inline-block text-body text-muted hover:underline" href="/products">
            Voltar para produtos
          </Link>
        }
        actions={
          manage && row.active ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setEditing(true)}>Editar produto</Button>
              <CatalogArchive resource="products" id={id} version={row.version} />
            </div>
          ) : undefined
        }
      />
      <RecordSummary
        notes={row.description}
        items={[
          { label: 'SKU', value: row.sku },
          { label: 'Unidade', value: row.unit },
          {
            label: 'Status',
            value: (
              <Badge variant={row.active ? 'success' : 'neutral'}>
                {row.active ? 'Ativo' : 'Arquivado'}
              </Badge>
            ),
          },
          { label: 'Atualizado em', value: new Date(row.updatedAt).toLocaleString('pt-BR') },
        ]}
      />
      <RecordDialog
        open={editing}
        onOpenChange={setEditing}
        title="Editar produto"
        description="Confira os dados do produto antes de salvar."
      >
        {editing && <ProductForm record={row} onSaved={() => setEditing(false)} />}
      </RecordDialog>
    </>
  );
}
