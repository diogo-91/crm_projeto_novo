import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from './utils';
const variants = cva(
  'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-caption font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-muted text-muted',
        primary: 'bg-primary-soft text-warning',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);
export function Badge({
  variant,
  className,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof variants>) {
  return <span {...props} className={cn(variants({ variant }), className)} />;
}
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-caption font-semibold text-warning',
        className,
      )}
    >
      {initials}
    </span>
  );
}
