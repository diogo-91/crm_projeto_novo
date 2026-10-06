'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
function OverlayContent({
  children,
  className,
  sheet,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { sheet?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-(--layer-overlay) bg-sidebar/45" />
      <DialogPrimitive.Content
        {...props}
        className={cn(
          'fixed z-(--layer-dialog) bg-surface shadow-overlay',
          sheet
            ? 'inset-y-0 left-0 w-sidebar max-w-full overflow-y-auto'
            : 'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6',
          className,
        )}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Fechar"
          className={cn(
            'absolute right-3 top-3 rounded-md p-2',
            sheet
              ? 'text-sidebar-foreground hover:bg-sidebar-hover'
              : 'text-muted hover:bg-surface-muted',
          )}
        >
          <X aria-hidden="true" className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export function DialogContent(props: ComponentProps<typeof DialogPrimitive.Content>) {
  return <OverlayContent {...props} />;
}
export function Sheet({
  open,
  onOpenChange,
  children,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <OverlayContent sheet className="bg-sidebar text-sidebar-foreground">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">Navegue pelos módulos do CRM.</DialogDescription>
        {children}
      </OverlayContent>
    </DialogPrimitive.Root>
  );
}
