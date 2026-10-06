'use client';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from './utils';
export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuLabel = DropdownPrimitive.Label;
export const DropdownMenuSeparator = DropdownPrimitive.Separator;
export function DropdownMenuContent(props: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        {...props}
        sideOffset={8}
        className={cn(
          'z-(--layer-dialog) min-w-56 rounded-lg border bg-surface p-2 shadow-overlay',
          props.className,
        )}
      />
    </DropdownPrimitive.Portal>
  );
}
export function DropdownMenuItem(props: ComponentProps<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      {...props}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-body outline-none focus:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.className,
      )}
    />
  );
}
