# ADR-001 — Monólito modular e monorepo

Status: decisão inicial; implementação pendente. Data: 2026-10-06.

## Context

O CRM começa sem código, com muitos domínios futuros e equipe pequena. Precisa de limites claros e evolução incremental, sem custos iniciais de sistemas distribuídos. Stack e árvore pnpm/Turborepo foram definidas pelo projeto.

## Decision

Usar monólito modular NestJS, organizado por capacidade, em `apps/api`. `apps/worker` executa jobs do mesmo produto em processo próprio e importa somente exports públicos dos módulos backend, sem carregar bootstrap HTTP. API não importa worker. Um PostgreSQL é compartilhado com ownership de tabelas por módulo. Releases de API/worker são compatíveis; suas diferenças de escala não os tornam microserviços.

Frontend Next.js em `apps/web`; pacotes database, contracts, ui, config, eslint-config e typescript-config com limites descritos em ARCHITECTURE.md. Domínio TypeScript puro, application coordena casos de uso, infrastructure implementa persistência/fornecedores, presentation trata transporte. Aplicar camadas proporcionalmente; não criar arquivo/classe por convenção sem responsabilidade real.

Dependencies cruzadas só pelos contratos públicos. Adapters ligados pelo composition root. CI futuro valida ciclos/imports. Transações locais podem passar contexto técnico entre infraestrutura de módulos para preservar invariantes, sem Prisma no domínio.

## Alternatives Considered

- Microserviços: isolamento operacional maior, mas rede, consistência, deploy e observabilidade custariam antes de haver escala/requisitos concretos.
- Monólito sem módulos: simples no começo, porém facilita writes cruzados, ciclos e regras dispersas.
- Pacote de domínio backend adicional já na fundação: evita import worker→API, mas acrescenta estrutura antes de prova de necessidade. Reavaliar se exports/builds ficarem difíceis.
- CQRS completo/event sourcing: não necessários para histórico comercial, audit ou filas; introduzem reconstrução/projeções e modelo operacional adicional.

## Consequences

Deploy, banco e transações são simples; workers podem escalar separadamente com o mesmo código. Limites são disciplina de código/lint, não barreiras físicas de banco. Um módulo não usa repository interno de outro. Uma falha na API ou DB ainda pode afetar o produto inteiro.

Extração futura exige evidência de escala/regulação, contrato e ADR; não está no roadmap inicial. Não usar HTTP entre módulos, Kubernetes ou barramento universal para simular microserviços dentro do monólito.
