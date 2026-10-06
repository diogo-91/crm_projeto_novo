import type { ComponentProps } from 'react';
import { cn } from './utils';
export function Card(props: ComponentProps<'section'>) {
  return (
    <section
      {...props}
      className={cn('rounded-lg border bg-surface shadow-soft', props.className)}
    />
  );
}
export function CardHeader(props: ComponentProps<'div'>) {
  return <div {...props} className={cn('space-y-1 p-6', props.className)} />;
}
export function CardTitle(props: ComponentProps<'h2'>) {
  return <h2 {...props} className={cn('text-base font-semibold', props.className)} />;
}
export function CardDescription(props: ComponentProps<'p'>) {
  return <p {...props} className={cn('text-body text-muted', props.className)} />;
}
export function CardContent(props: ComponentProps<'div'>) {
  return <div {...props} className={cn('px-6 pb-6', props.className)} />;
}
export function CardFooter(props: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn('flex items-center gap-3 border-t px-6 py-4', props.className)} />
  );
}
