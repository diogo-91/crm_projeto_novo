import type { ComponentProps, ReactNode } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { cn } from './utils';
import { Button } from './button';
export function Skeleton(props: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-secondary', props.className)}
    />
  );
}
export function Alert({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-md border border-danger/20 bg-danger-soft p-4 text-body text-danger',
        className,
      )}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  icon = <Inbox />,
  action,
  headingLevel = 2,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-xl border bg-surface-muted text-muted [&_svg]:size-6"
      >
        {icon}
      </div>
      <Heading className="text-base font-semibold">{title}</Heading>
      <p className="mt-2 max-w-md text-body text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
export function ErrorState({
  title = 'Não foi possível carregar',
  description = 'Tente novamente em instantes.',
  retry,
  headingLevel = 2,
}: {
  title?: string;
  description?: string;
  retry?: (() => void) | undefined;
  headingLevel?: 1 | 2;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      headingLevel={headingLevel}
      icon={<AlertCircle />}
      {...(retry
        ? {
            action: (
              <Button variant="outline" onClick={retry}>
                Tentar novamente
              </Button>
            ),
          }
        : {})}
    />
  );
}
