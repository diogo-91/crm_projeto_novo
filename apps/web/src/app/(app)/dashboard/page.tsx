import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, UsersRound, Columns3, CheckSquare } from 'lucide-react';
import { Badge, Card, CardHeader, CardTitle, CardDescription, EmptyState } from '@crm/ui';
import { PageHeader } from '@/components/layout/page-header';
import { MetricCard } from '@/components/layout/metric-card';
export const metadata: Metadata = { title: 'Dashboard' };
const areas = [
  {
    title: 'Relacionamentos',
    description: 'Clientes, empresas e novas conexões.',
    href: '/contacts',
    icon: UsersRound,
  },
  {
    title: 'Oportunidades',
    description: 'Cada negociação, no momento certo.',
    href: '/pipeline',
    icon: Columns3,
  },
  {
    title: 'Próximos passos',
    description: 'Organização para o dia a dia.',
    href: '/tasks',
    icon: CheckSquare,
  },
] as const;
export default function Dashboard() {
  return (
    <>
      <PageHeader
        title="Seu trabalho, em perspectiva."
        description="Bem-vindo ao seu espaço. Uma base organizada para as relações e oportunidades que vêm a seguir."
        actions={<Badge variant="primary">Visão geral</Badge>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Relacionamentos"
          value="—"
          variation="Indicadores disponíveis em breve"
          icon={<UsersRound />}
        />
        <MetricCard
          title="Oportunidades"
          value="—"
          variation="Indicadores disponíveis em breve"
          icon={<Columns3 />}
        />
        <MetricCard
          title="Próximos passos"
          value="—"
          variation="Indicadores disponíveis em breve"
          icon={<CheckSquare />}
        />
      </div>
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Uma visão do que importa</CardTitle>
              <CardDescription>Seu acompanhamento comercial terá um lugar aqui.</CardDescription>
            </div>
            <Badge>Em breve</Badge>
          </div>
        </CardHeader>
        <EmptyState
          title="O próximo capítulo começa com sua equipe"
          description="Os indicadores serão disponibilizados conforme os módulos comerciais entrarem em operação. Por enquanto, explore as áreas do seu espaço."
        />
      </Card>
      <div className="mb-4 mt-8 flex items-center justify-between">
        <h2 className="text-base font-semibold">Explore seu espaço</h2>
        <span className="text-caption text-muted">Tudo conectado, um passo de cada vez</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {areas.map((area) => (
          <Link key={area.href} href={area.href} className="group rounded-lg">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader>
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-surface-muted text-muted">
                    <area.icon aria-hidden="true" className="size-5" />
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4 text-muted" />
                </div>
                <CardTitle>{area.title}</CardTitle>
                <CardDescription>{area.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
