'use client';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from './utils';
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-body font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:brightness-95',
        secondary: 'bg-secondary hover:bg-border',
        outline: 'border bg-surface hover:bg-surface-muted',
        ghost: 'hover:bg-surface-muted',
        danger: 'bg-danger text-surface hover:brightness-95',
        link: 'text-info underline-offset-4 hover:underline',
      },
      size: { sm: 'h-8 px-3 text-caption', md: 'h-10 px-4', lg: 'h-12 px-6', icon: 'size-10' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean }) {
  const Component = asChild ? Slot : 'button';
  const inactive = disabled || loading;
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : inactive}
      aria-disabled={inactive || undefined}
      aria-busy={loading || undefined}
      {...props}
      onClickCapture={(event) => {
        if (inactive) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        props.onClickCapture?.(event);
      }}
    >
      {loading && <LoaderCircle aria-hidden="true" className="animate-spin" />}
      <Slottable>{children}</Slottable>
    </Component>
  );
}
