import Link from 'next/link';
import { Button, EmptyState } from '@crm/ui';
import { Compass } from 'lucide-react';
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <EmptyState
        headingLevel={1}
        title="Página não encontrada"
        description="Este endereço não está disponível. Volte para seu espaço de trabalho."
        icon={<Compass />}
        action={
          <Button asChild>
            <Link href="/dashboard">Voltar ao início</Link>
          </Button>
        }
      />
    </main>
  );
}
