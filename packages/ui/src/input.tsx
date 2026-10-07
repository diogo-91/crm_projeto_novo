import type { ComponentProps, ReactNode } from 'react';
import { cn } from './utils';
export function Label(props: ComponentProps<'label'>) {
  return <label {...props} className={cn('text-label font-medium', props.className)} />;
}
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cn(
        'h-11 w-full min-w-0 rounded-md border bg-surface px-3 text-body placeholder:text-muted disabled:opacity-50 aria-invalid:border-danger',
        className,
      )}
    />
  );
}
export function FormField({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      className={cn(
        'min-h-24 w-full rounded-md border bg-surface p-3 text-body placeholder:text-muted aria-invalid:border-danger disabled:opacity-50',
        className,
      )}
    />
  );
}
