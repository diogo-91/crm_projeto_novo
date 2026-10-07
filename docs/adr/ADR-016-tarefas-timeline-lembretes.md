# ADR-016 — Tarefas, timeline e lembretes duráveis

Status: aceito. Data: 2026-10-07. Escopo: fase 7 explicitamente autorizada.

## Context

Tarefas e follow-ups precisam de conclusão/reabertura segura, um alvo primário íntegro e histórico consultável. Redis pode perder jobs e o worker pode reiniciar depois do enqueue ou commit. A mesma identidade opera em tenants e carteiras diferentes. A fase 7 tem um consumidor concreto de notificações internas; não autoriza WhatsApp, e-mail, calendários, automações ou auditoria completa.

## Decision

Tasks owns Task, TaskHistory e TaskReminder. Activities owns interações manuais imutáveis; Notifications owns avisos persistidos e leitura pelo destinatário. API e worker continuam processos do mesmo monólito. TasksCore publica consultas e resolução de alvos; sua composição HTTP fica separada. Dependências são unidirecionais: tarefas consultam gateways públicos de Contacts/Leads/Opportunities; Activities agrega gateways de Tasks/Opportunities; a entrega de lembrete chama NotificationsDeliveryGateway. Nenhum módulo escreve entidades alheias diretamente.

Task possui organização, filial e ownerMembershipId ligados por FK a MembershipBranch, kind TASK/FOLLOW_UP, prioridade, OPEN/COMPLETED, vencimento/lembrete UTC e versão. Sem alvo ou exatamente um Contact, Lead ou Opportunity por FKs tenant+ID e CHECK de cardinalidade. Activity exige exatamente um desses alvos; Conversation/Quote ficam para suas fases. O alvo não amplia acesso: consultas de tarefas intersectam sua permission/scope com a leitura atual do alvo no SQL antes da paginação. Atividades exigem leitura do alvo e activities.read/create no scope do mesmo grant. Alvo desativado mantém histórico, mas não recebe nova interação/vínculo.

PATCH, conclusão, reabertura e arquivamento exigem expectedVersion, revalidação da sessão/grants e lock curto da tarefa. Alterações gravam TaskHistory na mesma transação, com versão única. Transferência exige update/assign na origem e destino; não muda tenant. Follow-up é finalidade da tarefa, sem engine de recorrência. Conclusão e arquivamento cancelam intenções pendentes; reabertura pode gerar nova ocorrência, inclusive imediata se já vencida.

Datas do contrato exigem ISO com offset explícito e são armazenadas UTC. Formulários mostram/convertem no fuso do navegador e rejeitam horário local inexistente; o filtro Hoje envia intervalo UTC do dia local. Edição que não altera campos de data preserva o instante original, inclusive segundos/milissegundos, sem reagendar por truncamento de apresentação. A opção today da API, quando usada diretamente, significa dia UTC. Lembrete exige vencimento e não pode ocorrer depois dele. Nenhum fuso fixo brasileiro ou calendário recorrente é presumido.

Task.reminderVersion muda apenas quando alvo, atribuição, vencimento/lembrete ou lifecycle mudam. Edição de título/descrição não cria aviso duplicado. A mesma transação persiste TaskReminder com unique tenant+tarefa+geração. **Essa intenção específica é o handoff durável**, dispensando OutboxEvent/EventReceipt genéricos para um efeito local já identificado. Não é dual write banco/Redis: request grava só PostgreSQL. ADR-007 continua obrigatório para efeitos externos futuros e fanout independente.

Worker passa a exigir DATABASE_URL, sem JWT ou credencial de sessão. Reconciliador seleciona até 25 intenções vencidas via FOR UPDATE SKIP LOCKED e lease/token de 60s; transação encerra antes do enqueue. A fila notifications tem concorrência 4, payload versionado apenas com reminderId, jobId UUID determinístico, cinco tentativas e backoff exponencial 1–60s. Failed set retém até 1000 jobs e o banco conserva FAILED/attemptCount/código seguro; o banco é autoridade mesmo após perda de Redis. Poll de 15s recupera leases expirados e jobs concluídos/removidos sem efeito persistido. Atualizações de dispatcher exigem token de posse; enqueue não significa COMPLETED.

Consumidor carrega intenção do banco, bloqueia recipient membership → Task → TaskReminder e revalida usuário/membership/organização/grants e visibilidade atual. Não fabrica sessão/JWT para sistema: AccessControl compartilha leitura de grants e retorna ResourceContext, distinto do TenantContext autenticado. Intenção obsoleta, tarefa concluída/arquivada ou acesso revogado é CANCELED sem retry. Efeito local Notification+COMPLETED ocorre numa transação. FK composta obriga destinatário da Notification a coincidir com TaskReminder; unique de origem+destinatário impede duplicação após retry/crash. Não se envia conteúdo pessoal para Redis nem se registra título/descrição nos logs. Falha de job usa mensagem fixa, preserva a causa em memória e não persiste exceção Prisma/SQL bruta em failedReason.

Falhas transitórias têm contagem/código seguro e próximo horário persistidos. Backoff BullMQ inclui jitter de até 20%, limitado a 60s e nunca anterior ao checkpoint PostgreSQL. Payload de job incompatível é falha permanente, sem retries. Duplicata anterior ao horário agendado não consome tentativa nem entrega antecipadamente. FAILED exige retry autorizado e versão atual da tarefa; nunca antecipa seu remindAt; preserva identidade do trabalho. Logs de reconciliação registram pendentes/falhos/lag e logs de jobs usam apenas IDs. API expõe estado do lembrete por tarefa autorizada. Worker para aquisição, drena jobs e fecha filas antes da desconexão PostgreSQL; DatabaseService encerra conexão em onApplicationShutdown, após onModuleDestroy dos consumidores.

Timeline agrega interações manuais, TaskHistory autorizado e movimentações existentes para o alvo Opportunity. Cada fonte aplica autorização e cursor temporal antes de buscar até limit+1. Merge por createdAt/id desc conserva paginação sem total fictício. Não agrega automaticamente alvos relacionados nem replica históricos existentes em Activity. Não é AuditLog, event sourcing ou uma timeline de integrações futuras.

Notificações são privadas da membership no tenant selecionado, mesmo com grant organizacional. Listagem/leitura intersectam visibilidade atual da tarefa/alvo. Não persistem cópia de título comercial; a projeção resolve o título autorizado no momento da leitura. Permissões notifications.read/update são capacidades de caixa privada; a restrição comercial vem de tasks.read e do alvo. Scopes organizacionais nunca ampliam o conjunto de destinatários. Marcar como lida é idempotente. Frontend reutiliza sessão/cache existentes, pagina notificações e consulta a cada 30s apenas em foreground; não adiciona Socket.IO nesta etapa.

Permissões novas: tasks.read/create/update/delete/assign/complete, activities.read/create, notifications.read/update. ADMIN recebe todas; DIRECTOR/SALES_MANAGER recebem atribuição sem delete; SELLER/AFTER_SALES recebem ações próprias sem assign/delete; VIEWER recebe leitura e marcação de suas notificações. Templates não definem scope. Seed amplia somente demo e provisionamento autorizado de novos tenants; migration não concede privilégios a tenants anteriores.

## Alternatives Considered

- Enfileirar direto após PATCH: janela de perda; rejeitado.
- Outbox/event bus universal junto a intenção específica: estado duplicado sem segundo consumidor; rejeitado.
- Cron de calendário ou scheduler dedicado por follow-up: não há requisito de recorrência; rejeitado.
- Permitir tarefa revelar alvo oculto ou notification ampla por organização: viola isolamento; rejeitado.
- Copiar todo histórico comercial para Activity: duplica responsabilidade e eventos; leitura agregada adotada.
- Falso Principal/JWT no worker: mistura sessão interativa com entrega persistida; ResourceContext explícito adotado.

## Consequences

Entrega interna eventual, recuperável e deduplicada pelo banco; pode atrasar durante indisponibilidade. Reconciliação não oferece SLA nem exactly-once externo. Filtragem do alvo pode ocultar tarefa/notificação após reatribuição; não preservar privilégio pelo vínculo antigo. Histórico usa acesso atual, não ACL histórica. Dados de jobs e intenções permanecem até política de retenção operacional aprovada, sem limpeza automática que quebre replay. PostgreSQL/Redis ainda são pontos únicos iniciais; HA e restore continuam requisitos de hardening. Sem nova dependência tecnológica além de usar BullMQ já fixado diretamente no worker. Fase 8 não iniciada.
