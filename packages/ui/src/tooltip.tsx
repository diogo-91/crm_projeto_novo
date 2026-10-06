'use client';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          sideOffset={8}
          className="z-(--layer-dialog) rounded-md bg-sidebar px-3 py-2 text-caption text-surface shadow-overlay"
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-sidebar" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
export const TooltipProvider = TooltipPrimitive.Provider;
