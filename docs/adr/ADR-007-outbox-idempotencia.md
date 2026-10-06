# ADR-007 — Outbox seletiva, deduplicação e reconciliação

Status: decisão inicial; implementação pendente. Data: 2026-10-06.

## Context

DB e Redis não compartilham transação. Aceitar webhook ou mudar estado e enfileirar depois pode perder trabalho; enfileirar antes do commit pode gerar efeito sem registro. Duplicatas, crashes e timeouts de fornecedores são normais.

## Decision

Usar transactional outbox apenas para efeitos importantes após commit: webhook aceito, envio pendente, stage com consumidor de automação/notificação, integração relevante de quote. Persistir estado+OutboxEvent na mesma transação. Não usar em GET, simples update sem efeito, presença/digitação ou auditoria que pode entrar na própria transação.

Dispatcher busca com SKIP LOCKED e lease/token, libera transação antes do enqueue. Estados PENDING/LEASED/DISPATCHED/COMPLETED/FAILED; enqueue não significa conclusão. jobId determinístico, constraints e EventReceipt+efeito local na mesma transação absorvem duplicatas. Reconciliador verifica entregas antigas/progresso antes de reenqueue, cobrindo perda de Redis.

Uma linha representa uma entrega lógica. Fanout real usa entregas filhas persistidas com identidade evento+destino; não concluir várias entregas pelo sucesso da primeira. Failed state é retido e replay autorizado não cria identidade nova inadvertidamente.

Idempotência de webhook usa conexão+tipo+ID/fingerprint estável, mensagem tem unique externa própria, API usa chave+ator+operação+hash em comandos críticos. Status fora de ordem tem regra de estado. Efeitos externos precisam de idempotência do provedor ou estado UNKNOWN e reconciliação/manual; receipt não comprova entrega remota.

## Alternatives Considered

- Dual write DB+Redis: simples, mas deixa janelas de perda/inconsistência.
- Transação distribuída: sem suporte/necessidade e operação excessiva.
- Event sourcing/outbox para cada write: transforma simplicidade em log universal sem objetivo.
- Só dedupe BullMQ: insuficiente após remoção de job/perda de Redis ou retry fora da fila.

## Consequences

Entrega at-least-once recuperável e mais estados/monitoramento/retention. Não há exactly-once ponta a ponta. Lease expirado não autoriza reenviar automaticamente efeito externo incerto. Limpeza de receipts respeita horizonte de replay/backup. Restore pode exigir suspender workers para reconciliar efeitos já realizados.

Outbox só será implementada com o primeiro consumidor real. Nenhum worker/dispatcher existe nesta fase.
