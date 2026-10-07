'use client';
import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Alert,
  toast,
} from '@crm/ui';
import { useArchive } from './queries';
import type { CommercialResource } from './queries';
import { errorMessage } from '@/lib/api-client';
export function ArchiveButton({
  resource,
  id,
  version,
}: {
  resource: Exclude<CommercialResource, 'tasks'> | 'tags';
  id: string;
  version: number;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useArchive(resource);
  const label =
    resource === 'contacts'
      ? 'cliente'
      : resource === 'companies'
        ? 'empresa'
        : resource === 'leads'
          ? 'lead'
          : resource === 'opportunities'
            ? 'oportunidade'
            : 'tag';
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Desativar {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">Desativar {label}?</DialogTitle>
          <DialogDescription className="mb-5 mt-2 text-body text-muted">
            O registro e seus relacionamentos serão preservados.
          </DialogDescription>
          {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={mutation.isPending}
              onClick={() => {
                mutation.mutate(
                  { id, version },
                  {
                    onSuccess: () => {
                      toast.success('Registro desativado.');
                      setOpen(false);
                    },
                  },
                );
              }}
            >
              Confirmar desativação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
