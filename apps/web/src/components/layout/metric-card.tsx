import type { ReactNode } from 'react';
import { Card, CardHeader, CardContent, Skeleton } from '@crm/ui';
export function MetricCard({
  title,
  value,
  variation,
  icon,
  loading = false,
}: {
  title: string;
  value: string;
  variation?: string;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <h2 className="text-body text-muted">{title}</h2>
        <span aria-hidden="true" className="text-muted [&_svg]:size-4">
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-semibold">{value}</p>
        )}
        {variation && <p className="mt-2 text-caption text-muted">{variation}</p>}
      </CardContent>
    </Card>
  );
}
