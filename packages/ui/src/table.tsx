import type { ComponentProps, ReactNode } from 'react';
import { cn } from './utils';
import { Skeleton } from './feedback';
export function Table(props: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table {...props} className={cn('w-full text-left text-body', props.className)} />
    </div>
  );
}
export function TableHeader(props: ComponentProps<'thead'>) {
  return <thead {...props} className="border-b bg-surface-muted text-caption text-muted" />;
}
export function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody {...props} className="divide-y" />;
}
export function TableRow(props: ComponentProps<'tr'>) {
  return <tr {...props} className={cn('hover:bg-surface-muted/50', props.className)} />;
}
export function TableHead(props: ComponentProps<'th'>) {
  return <th scope="col" {...props} className={cn('px-6 py-3 font-medium', props.className)} />;
}
export function TableCell(props: ComponentProps<'td'>) {
  return <td {...props} className={cn('px-6 py-4', props.className)} />;
}
export function TableState({
  columns,
  loading,
  children,
}: {
  columns: number;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <TableRow>
      <TableCell colSpan={columns}>
        {loading ? (
          <>
            <span role="status" className="sr-only">
              Carregando tabela
            </span>
            <Skeleton className="h-10" />
          </>
        ) : (
          children
        )}
      </TableCell>
    </TableRow>
  );
}
