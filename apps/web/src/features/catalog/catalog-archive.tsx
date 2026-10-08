'use client';
import { useState } from 'react';
import { Alert, Button, toast } from '@crm/ui';
import { RecordDialog } from '@/features/commercial/record-dialog';
import { errorMessage } from '@/lib/api-client';
import { useCatalogMutation } from './queries';
export function CatalogArchive({
  resource,
  id,
  version,
  productId,
}: {
  resource: 'products' | 'price-lists';
  id: string;
  version: number;
  productId?: string;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useCatalogMutation();
  const label = productId ? 'preço' : resource === 'products' ? 'produto' : 'tabela';
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
      >
        Arquivar {label}
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={`Arquivar ${label}?`}
        description="O registro e suas referências serão preservados."
      >
        {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                productId
                  ? { type: 'remove-price', id, productId, version }
                  : { type: 'archive', resource, id, version },
                {
                  onSuccess: () => {
                    toast.success('Registro arquivado.');
                    setOpen(false);
                  },
                },
              )
            }
          >
            Confirmar arquivamento
          </Button>
        </div>
      </RecordDialog>
    </>
  );
}
