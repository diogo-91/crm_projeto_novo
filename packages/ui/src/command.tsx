'use client';
import { Command as CommandPrimitive } from 'cmdk';
import type { ComponentProps } from 'react';
export function Command(props: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive {...props} className="text-body" />;
}
export function CommandInput(props: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <CommandPrimitive.Input
      {...props}
      className="mb-3 h-11 w-full rounded-md border bg-surface px-3 text-body"
    />
  );
}
export const CommandList = CommandPrimitive.List;
export const CommandEmpty = CommandPrimitive.Empty;
export function CommandItem(props: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      {...props}
      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 data-[selected=true]:bg-surface-muted [&_svg]:size-4"
    />
  );
}
