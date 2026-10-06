# ADR-009 — Frontend por features e contratos independentes do banco

Status: base implementada na fase 4; cache de dados e realtime permanecem planejados. Complementado pelo ADR-013. Data: 2026-10-06.

## Context

O menu futuro tem muitas capacidades; páginas grandes e componentes com chamadas de API espalhadas dificultam testes e evolução. A stack React/Next.js com TanStack Query, RHF e Zod precisa de fronteiras para não duplicar regras backend nem expor infraestrutura.

## Decision

Next.js App Router para páginas/layouts/boundaries. Features contêm componentes de domínio, hooks, services e schemas; packages/ui só primitives visuais shadcn/Tailwind. TanStack Query gerencia estado remoto; React Hook Form/Zod cuida de formulários. Backend continua fonte de verdade para regras, preço e permissões.

Cliente REST tipado depende de packages/contracts (schemas/tipos serializáveis), nunca Prisma/Nest. OpenAPI/validação alinhados com CI futuro. Configuração de cliente e servidor tem entrypoints separados; secrets não entram em NEXT_PUBLIC nem bundles.

Query keys incluem tenant/escopo; troca de organização cancela requests e limpa dados privados. Logout/identidade diferente limpa cache. Estratégia de hidratação server/client definida por página sem duas fontes concorrentes. Permissões ocultam ações, mas API reautoriza.

Socket só invalida/atualiza dados autorizados; refetch cobre perda e reconexão. Optimistic Kanban usa expectedVersion e rollback de conflito. Acessibilidade, loading/error/empty e layout responsivo entram com cada feature útil, sem telas vazias para todo o menu.

## Alternatives Considered

- Organizar tudo por tipo técnico: reduz pastas inicialmente, mas dispersa cada feature em vários lugares; camadas técnicas comuns continuam pequenas.
- Importar ORM no Next.js: atalha consultas, porém cria segunda autorização/backend e acopla contratos ao banco.
- Estado global para todas as respostas: duplica cache/sincronização já resolvidos por TanStack Query.
- Gerar todos os componentes/telas antecipadamente: cria manutenção sem feedback/caso real.

## Consequences

UI e features crescem incrementalmente; cache/SSR/scopes exigem testes explícitos. Schemas comuns cuidam de formato, não eliminam validação backend. packages/ui não contém clientes/opportunities nem chamadas HTTP.

Na fase 0, nenhuma página, componente ou dependência foi criada. A fase 4 materializa features de autenticação, cliente REST, UI e layout. Sua solicitação explícita autoriza páginas-base para todas as entradas do menu, conforme ADR-013; não há funcionalidade comercial. TanStack Query será introduzido com dados interativos, sem duplicar o proprietário da sessão. As regras de isolamento/limpeza de cache acima continuam obrigatórias nesse momento.
