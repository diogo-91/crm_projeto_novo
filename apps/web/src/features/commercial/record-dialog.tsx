'use client';
import { useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@crm/ui';
export function RecordDialog({
  open,
  onOpenChange,
  title,
  children,
  fallbackFocus,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  children: ReactNode;
  fallbackFocus?: RefObject<HTMLElement | null>;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={() => {
          const active = document.activeElement;
          returnFocus.current = active instanceof HTMLElement ? active : null;
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocus.current?.isConnected
            ? returnFocus.current
            : fallbackFocus?.current;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
        className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto"
      >
        <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        <DialogDescription className="mb-6 mt-2 text-body text-muted">
          Confira os dados e a atribuição à filial antes de salvar.
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
