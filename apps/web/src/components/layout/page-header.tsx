import type { ReactNode } from 'react';
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-body text-muted">{description}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}
