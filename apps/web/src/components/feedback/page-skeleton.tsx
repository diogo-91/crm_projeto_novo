import { Card, CardContent, Skeleton } from '@crm/ui';
export function PageSkeleton() {
  return (
    <div role="status" className="w-full space-y-6 p-6 md:p-8">
      <span className="sr-only">Carregando seu espaço de trabalho</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64 max-w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <Card key={key}>
            <CardContent className="pt-6">
              <Skeleton className="h-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
