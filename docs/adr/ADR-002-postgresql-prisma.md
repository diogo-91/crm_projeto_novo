# ADR-002 — PostgreSQL, Prisma e integridade tenant

Status: decisão inicial; implementação pendente. Data: 2026-10-06.

## Context

Contatos, oportunidades, orçamentos, permissões e mensagens têm relacionamentos e invariantes transacionais. Type safety ajuda manutenção, mas isolamento multiempresa não pode depender apenas da interface ou de IDs difíceis de adivinhar.

## Decision

PostgreSQL com Prisma; schema compartilhado e organizationId em entidades tenant. User é identidade global; OrganizationMembership define vínculo. UUID, tempos timestamptz UTC, money Decimal e contratos serializados por DTOs.

FKs compostas por tenant reforçam queries autorizadas. Stage usa referência incluindo pipeline; mensagem usa conversa/canal coerentes. Migrations versionadas/revisadas; SQL manual quando Prisma não expressar checks/partial indexes. Aplicação usa permissões DML mínimas; migration tem credencial DDL separada. Nenhum acesso Prisma na web/domínio ou exposição direta de modelos ao cliente.

Migrations testadas desde banco vazio e release anterior; deploy único e expand/contract para mudanças incompatíveis. Backups e restore testados. Indexação conforme consultas reais, keyset pagination e limites/pool comuns API+worker.

## Alternatives Considered

- MongoDB/NoSQL: não acompanha invariantes relacionais/financeiras sem trabalho extra e diverge da stack definida.
- SQL direto para toda persistência: oferece controle, mas aumenta boilerplate; SQL parametrizado fica reservado a queries/constraints especializadas.
- Banco/schema por organização: isolamento físico superior, com alto custo de migrations, conexões e operação inicial.
- Somente filtro Prisma automático: insuficiente em nested writes, joins, raw SQL e relações inconsistentes.
- RLS desde já: defesa adicional interessante, mas exige identidade/set/reset por transação e testes com pooling; fica para decisão própria baseada em requisitos.

## Consequences

Integridade local e tipagem previsíveis. FKs compostas requerem campos/uniques extras e revisão de SQL. Schema compartilhado mantém risco de query sem filtro: contexto obrigatório, repos explícitos e testes negativos continuam necessários.

RLS, particionamento ou isolamento físico não estão implementados. Cascata indiscriminada/`db push`/reset de produção são proibidos. Ver DATABASE.md para ERD, constraints, índices e retenção.
