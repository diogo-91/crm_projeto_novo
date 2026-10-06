import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
} from '@crm/ui';
import { navigation } from '../navigation/navigation';
import { PageHeader } from './page-header';
export function ModulePlaceholder({ href }: { href: string }) {
  const item = navigation.find((entry) => entry.href === href);
  if (!item) throw new Error('Unknown module route');
  return (
    <>
      <PageHeader
        title={item.label}
        description={item.description}
        actions={<Badge variant="primary">Em breve</Badge>}
      />
      <Card>
        <EmptyState
          title={`Seu espaço de ${item.label.toLowerCase()}`}
          description={
            item.phase > 4
              ? `Este módulo será disponibilizado na fase ${item.phase}. Tudo começa com uma base bem organizada para sua equipe.`
              : 'Este espaço está preparado para as próximas etapas. A gestão será disponibilizada em uma fase posterior.'
          }
          icon={<item.icon />}
        />
      </Card>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-primary-soft text-warning">
              <Sparkles aria-hidden="true" className="size-4" />
            </div>
            <CardTitle>Um passo de cada vez</CardTitle>
            <CardDescription>
              Estamos preparando uma experiência simples, consistente e conectada ao seu trabalho.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Explore seu espaço</CardTitle>
            <CardDescription>
              Conheça as áreas disponíveis na navegação e encontre seu próximo ponto de partida.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                Ir para a visão geral
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
