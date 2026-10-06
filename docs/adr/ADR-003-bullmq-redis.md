# ADR-003 — BullMQ/Redis para execução assíncrona

Status: decisão inicial; implementação pendente. Data: 2026-10-06.

## Context

Mensagens, notificações, automações, imports e relatórios não devem bloquear requests. Jobs podem ser entregues novamente, atrasar ou desaparecer quando Redis perde estado. Precisamos de retries e operação compreensíveis para uma equipe pequena.

## Decision

BullMQ em Redis, consumido por apps/worker. Filas previstas: inbound-message-processing, outbound-messages, automations, notifications, imports e reports. Criar cada fila apenas quando houver consumidor real.

Default para falha transitória segura: 5 tentativas, exponential backoff 1–60 s com jitter e respeito a Retry-After; ajustar por workload. Falha permanente sem retry automático. Efeito externo incerto segue política própria, sem reenvio cego. Concorrência limitada por processo, conexão, tenant e conversa conforme o caso.

Payloads mínimos com IDs/versão/correlação, jobId determinístico sem `:` e idempotência no PostgreSQL; jobId sozinho não basta. Failed set com retenção + estado/falha durável no banco é solução inicial equivalente à DLQ. Replay seletivo com autorização e identidade preservada. Monitorar lag, attempts, stalled e duração; dashboard privado.

Redis com persistência, `noeviction` e limites; intenção/progresso comercial duráveis no PostgreSQL e reconciliação. Shutdown gracioso, leases/heartbeat e checkpoints. Outbox para handoff importante conforme ADR-007.

## Alternatives Considered

- Processar tudo na request: piora latência e perde trabalho em timeout/crash.
- RabbitMQ/Kafka: capacidades relevantes em outros contextos, mas adicionam operação e não são necessários para o fluxo inicial.
- PostgreSQL como executor universal de filas: possível, porém não aproveita BullMQ/retries/concurrency da stack escolhida.
- DLQ adicional já no início: mais roteamento e possibilidade de loops; failed jobs persistidos são suficientes até necessidade concreta.

## Consequences

API é responsiva e workloads escalam por worker, mas processamento é eventual e at-least-once. Reconciliation/monitoramento são requisitos, não extras. Redis é ponto único de falha inicial; outbox reduz perda, não indisponibilidade. Cache/socket precisam de isolamento operacional se competirem com filas.

Nenhuma fila nem worker está implementado nesta fase.
