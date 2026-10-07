import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
export function RecordSummary({
  items,
  notes,
}: {
  items: { label: string; value: ReactNode }[];
  notes: string | null;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-6 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="text-caption text-muted">{item.label}</dt>
                <dd className="mt-1 break-words text-body">{item.value ?? 'Não informado'}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap break-words text-body">
            {notes || 'Nenhuma observação registrada.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
