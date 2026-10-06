# ADR-005 — REST versionada e contratos OpenAPI

Status: decisão inicial; implementação pendente. Data: 2026-10-06.

## Context

Web, integrações e futuras aplicações precisam de fronteira tipada e documentada. Controllers devem tratar transporte sem virar domínio; compartilhamento de modelos Prisma exporia dados e acoplaria banco e frontend.

## Decision

REST NestJS em `/api/v1`, Swagger/OpenAPI e contracts públicos serializáveis em packages/contracts. Validar entrada por schemas/DTOs explícitos e mapear saídas; Zod para contratos/formulários conforme integração Nest compatível. Documentação e validação não podem divergir silenciosamente.

Recursos plurais, ações comerciais explícitas, HTTP status coerentes e `application/problem+json` RFC 9457 com code/requestId seguros. Cursor/limites/allowlists para listas. Datas ISO UTC e decimals como strings. 202 apenas após persistência de trabalho assíncrono, com recurso de acompanhamento autorizado.

Idempotency-Key para comandos relevantes, expectedVersion para disputa de estado, autorização de objeto no caso de uso. API é fonte de verdade. Socket.IO serve invalidação/atualização do cliente, não mutations comerciais inicialmente. Contratos aditivos por padrão; breaking changes exigem estratégia/versionamento.

## Alternatives Considered

- GraphQL: flexibilidade de consultas, mas complexidade adicional de autorização/query cost e desnecessário para o CRM inicial; explicitamente excluído.
- RPC interno/público: integração fortemente dependente de clientes/stack sem vantagem demonstrada.
- Expor modelos ORM: reduz DTOs, mas acopla schema, expõe campos internos e permite mass assignment.
- WebSocket para todo comando: reduz clareza de retry/status/contrato e operação; REST resolve a necessidade.

## Consequences

Contrato previsível, ferramentas consolidadas e testes claros. É necessário manter geração/schema/testes de compatibilidade; type-only não valida runtime. Paginação, autorização e índices precisam de design por recurso.

Nenhum endpoint ou OpenAPI gerado existe nesta fase; convenções serão implementadas na fundação e nas features.
