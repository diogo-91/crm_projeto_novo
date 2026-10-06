'use client';
import { Toaster as Sonner } from 'sonner';
export { toast } from 'sonner';
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      hotkey={[]}
      customAriaLabel="Notificações"
      closeButton
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: 'Fechar notificação',
        classNames: {
          toast:
            'flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-foreground shadow-overlay',
          title: 'text-body font-medium',
          description: 'text-caption text-muted',
          closeButton: 'rounded-full border bg-surface p-1',
          actionButton: 'rounded-md bg-primary px-3 py-2 text-primary-foreground',
        },
      }}
    />
  );
}
