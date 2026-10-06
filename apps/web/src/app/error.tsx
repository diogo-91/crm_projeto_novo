'use client';
import { ErrorState } from '@crm/ui';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg p-8">
      <ErrorState
        headingLevel={1}
        title="Algo não saiu como esperado"
        description="Não foi possível abrir esta página. Tente novamente."
        retry={reset}
      />
    </main>
  );
}
