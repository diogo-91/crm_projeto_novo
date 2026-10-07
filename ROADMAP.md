# Roadmap incremental

## Como executar

Cada fase deve ser dividida em PRs pequenos, com contrato, implementação autorizada, testes e documentação. Este roadmap **não autoriza execução das próximas fases**. As fases 0–5 estão concluídas. A fase 6 exige nova solicitação. Não gerar todos os módulos/arquivos de uma vez. Decisões só ganham infraestrutura quando um consumidor real precisar.

Definition of Done de uma feature: critérios de negócio claros; isolamento organização/filial/carteira; autorização granular; validação e erros; contrato OpenAPI; migration revisada quando existir; testes críticos; logs sem secrets; UI acessível quando pertinente. Falhas conhecidas e testes não executados são explícitos. Nenhuma fase é concluída apenas por scaffold/build.

## Fase 0 — Arquitetura (concluída)

- Documentar arquitetura, módulos, dependências, segurança, persistência e processos assíncronos.
- Definir modelo conceitual/ERD, RBAC por ação+escopo e estratégia de sessão.
- Registrar ADRs e revisar acoplamento, tenant, concorrência, durabilidade e fornecedores.
- Criar AGENTS.md com regras e comandos planejados marcados como indisponíveis.

Saída: quatro documentos e nove ADRs. Gate: revisão documental consistente; nenhuma funcionalidade, dependência, tela, CRUD ou migration criada. Documentação não demonstra prontidão operacional.

## Fase 1 — Fundação (concluída)

1. Fixar versões compatíveis de Node.js/pnpm/Next/Nest/Prisma e demais ferramentas; criar workspace pnpm/Turborepo e lockfile.
2. Criar apenas bootstraps úteis web/API/worker e pacotes de configuração/contratos/database/UI; validar import unidirecional worker→exports backend e builds isolados.
3. Docker/Compose PostgreSQL e Redis; configuração validada, `.env.example` sem secrets e serviços/testes isolados.
4. Scripts da tabela de AGENTS.md, build/typecheck/lint, CI mínimo; escolher runner sem duplicação desnecessária.
5. Logs estruturados/correlação, mapper de erros/OpenAPI, health/live/ready e shutdown de API/worker. Skeleton técnico não é tela de CRM.

Gate: instalação congelada repetível, serviços sobem, health responde, build/typecheck/lint e smoke técnico útil passam. Serviços não dependem da Evolution. Somente nessa fase comandos passam a ser reais e AGENTS.md é atualizado com evidência.

Evidência de 2026-10-06: instalação normal/congelada, lint, typecheck, test e build passaram; 38 testes unitários/HTTP e 8 de integração. O fluxo pnpm dev serviu a página/Tailwind, health/live/ready, Swagger/assets e job técnico pelo worker separado. Migration/seed repetíveis, degradação/recovery e shutdown com código zero foram verificados. Nenhum módulo comercial foi antecipado.

## Fase 2 — Organização e usuários (concluída)

1. Schema incremental Organization, Branch, User global, OrganizationMembership e MembershipBranch; FKs compostas e principal vinculada à membership. Team/TeamMember e AuditLog ficam fora do escopo explicitamente autorizado.
2. Migration específica sem alterar a fase 1 e seed idempotente de uma organização/cinco filiais/uma identidade estrutural sem credenciais ou poderes.
3. API REST mínima local para criação/consulta de organização, filiais, novas identidades e associação explícita de identidade existente; validação, projeções seguras, erros e paginação.
4. Testes unitários/HTTP/integração PostgreSQL real: duas organizações em fixtures, constraints, isolamento estrutural, rollback, concorrência, migration limpa e seed repetido.

Gate: lint/typecheck/test/test:integration/build, migrations em banco limpo e atualizado, seed duas vezes, Swagger e API mínima funcionando. A autorização explícita atual substitui o gate antigo de ausência de endpoints: **gestão temporariamente não autenticada somente no loopback local**. Não publicar por proxy/túnel/deploy antes da fase 3. IDs/filtros/FKs não são autorização; não simular TenantContext ou API key provisória. ADR-011 registra a mudança de escopo/gate. Nenhum diretório global de usuários é exposto.

Evidência de 2026-10-06: install congelado, lint, typecheck, test, test:integration e build passaram; 61 testes unitários/HTTP e 27 integrações reais, preservando os testes da fase 1. PostgreSQL novo recebeu toda a cadeia de migrations; o banco local da fase 1 foi atualizado sem reset. Seed repetido preservou IDs/timestamps e o marcador técnico. Constraints rejeitaram cruzamentos de tenant e principal não atribuída; concorrência de e-mail/código/membership retornou um sucesso e um conflito. API/worker/web iniciaram em pnpm dev; health/live/ready, Swagger, organização demo/cinco filiais/membership e job técnico foram verificados. Nenhuma funcionalidade da fase 3 foi implementada.

## Fase 3 — Auth e RBAC (concluída)

1. Credencial Argon2id, login seguro, JWT curto e Session revogável/dispositivos independentes.
2. Refresh em cookie com rotação atômica, reuso/revogação, logout/logout-all, troca de senha e limites Redis.
3. Role/Permission/RolePermission/UserRole/UserRoleBranch, OWN/BRANCH/BRANCH_SET/ORGANIZATION e consultas autorizadas antes de paginação.
4. Proteger toda a API organizacional e gerir grants mínimos sem elevação; PlatformGrant temporal separado para criação de organização; logs estruturados de segurança.
5. Seed com senha via environment, migration incremental, testes reais de banco limpo e preservação de fases anteriores.

Gate: install/lint/typecheck/test/test:integration/build; tokens inválidos/expirados, refresh concorrente/reuso, revogação, Origin/CORS, grants mistos e isolamento tenant/filial/carteira. Recuperação/verificação de e-mail, AuditLog completo e frontend de login ficam fora da fase 3 por solicitação explícita (ADR-012); nenhuma implementação parcial ou segredo fake.

Evidência de 2026-10-06: instalação congelada, lint, typecheck, test, test:integration e build passaram. **140 testes: 75 unitários, 10 HTTP com dependências controladas e 55 integrações com PostgreSQL/Redis reais**. Toda a cadeia de quatro migrations foi aplicada em banco novo; seed repetido preservou credenciais, IDs, timestamps e grants. Testes cobrem rotação/reuso concorrente, troca de senha versus login/refresh, revogação, IDOR, grants mistos, escopos, limites Redis e FKs/triggers de tenant. O banco local da fase 2 foi atualizado sem reset e recebeu seed duas vezes; pnpm dev validou frontend/CSS, API/Swagger, auth, worker/job e logs sem secrets. Não foram implementadas telas de login, envio de e-mail ou funcionalidades comerciais.

## Fase 4 — Design system e layout (concluída)

1. UI shadcn/Tailwind, tokens visuais, acessibilidade e componentes usados pelo primeiro fluxo.
2. Layout autenticado, navegação, seleção de organização, filial principal somente leitura e estados loading/erro/vazio, conforme capacidades da API atual.
3. Cliente REST tipado, React Hook Form/Zod e fluxo de sessão single-flight coordenado entre abas; TanStack Query entra com dados remotos interativos, sem duplicar auth.
4. Limpeza de cache/requests ao trocar tenant e ocultação de ações conforme permissões.

Gate: layout responsivo e acessível, sessão funciona, dados não vazam entre usuários/tenants; backend continua autorizando. A solicitação explícita da fase 4 inclui páginas-base para todas as entradas do menu, com estrutura comum e sem funcionalidades/dados comerciais fictícios (ADR-013).

Evidência de 2026-10-06: install congelado, lint, typecheck, test, test:integration e build passaram. **197 testes: 118 unitários (44 de frontend/DOM), 10 HTTP, 55 integrações PostgreSQL/Redis e 14 E2E Chromium**. Os 140 cenários anteriores foram preservados. Login/refresh/logout/revogação, navegação completa, troca ADMIN A → VIEWER B, concorrência entre abas, canal nativo sem autodelivery, dialogs/teclado, 404, fonte local carregada e axe passaram. Login, Dashboard, placeholders e demonstração técnica de Configurações foram verificados em 375/768/1024/1440/1920px, sem overflow global, erros de aplicação ou hydration. pnpm dev iniciou web/API/worker; health/Swagger, admin demo, refresh/logout e job técnico passaram. Artefatos públicos foram conferidos sem secrets do servidor. Nenhuma migration, funcionalidade comercial ou fase 5 foi implementada.

## Fase 5 — Clientes e empresas (concluída)

1. Contact/Company e vínculos, CRUD autorizado e desativação; telefone de Contact único por tenant sem DDI inferido (ADR-014), e-mail comercial não único.
2. Carteira/filial e transferência auditada, busca paginada e filtros indexados.
3. Tag/ContactTag e gestão organizacional; formulários/lista/detalhe reais com erros e validação backend. Seed sem dados comerciais; fixtures sintéticas isoladas.

Gate: criação/leitura/alteração/arquivamento e isolamento API/web cobertos; joins Company/Contact não atravessam tenants; plano de consulta avaliado com volume representativo.

Evidência de 2026-10-07: instalação congelada, lint, typecheck, test, test:integration, build e test:e2e passaram. **270 testes: 161 unitários (incluem 58 frontend/DOM), 10 HTTP, 79 integrações PostgreSQL/Redis e 20 E2E Chromium**. Os 197 testes anteriores foram preservados. Seis migrations aplicadas em PostgreSQL limpo e seed repetido; FKs cruzadas, constraints/corridas, quatro scopes para Contact e Company, versionamento, rollback, histórico de transferência e invalidação de cache cobertos. Plano de consulta avaliado com 2000 registros sintéticos; projeções batched sem N+1. Jornada comercial real, cinco larguras, axe, foco, console e troca de contexto passaram. Banco local anterior recebeu duas migrations incrementais e seed repetido, sem clientes/empresas/tags fictícios. pnpm dev iniciou web/API/worker: health/Swagger, login/logout, páginas/listas autenticadas e job técnico passaram. Artefatos públicos e logs conferidos sem secrets do servidor. ADR-014 documenta as decisões. Nenhuma funcionalidade da fase 6 implementada.

## Fase 6 — Leads e pipeline

1. Lead e conversão local transacional, dedupe por lead, Contact/Company e Opportunity.
2. Pipeline/Stage com constraints de mesmo pipeline e escopo, arquivamento e posição.
3. Opportunity/StageHistory, expectedVersion e timeline mínima do histórico.
4. Kanban com mutation autorizada, optimistic update/rollback e resposta de conflito.

Gate: pipeline e movimentação testados, histórico+estado atômicos, corrida/dupla conversão não duplica; OWN/filiais respeitados. Outbox entra nesta fase apenas se existir consumidor concreto do efeito; não construir framework de eventos por antecipação.

## Fase 7 — Tarefas, follow-ups e timeline

1. Task e Activity com referências explícitas, dono, filial e vencimento.
2. Concluir/reabrir tarefa com versionamento/regras; timeline agregada autorizada.
3. Notification mínima persistida para lembretes reais; scheduler/jobs apenas para esse uso, com checkpoints e dedupe.

Gate: vencimento/fuso/conclusão e visibilidade da timeline cobertos. Se jobs forem introduzidos aqui, primeiro implantar retry, estado durável e monitoramento mínimos; não aceitar lembretes sem recuperação de falha.

## Fase 8 — WhatsApp / Evolution API

1. Confirmar versão/capacidades oficiais, sandbox, credenciais, autenticação de webhook e contrato de adapter; ADR de detalhes externos se necessário.
2. MessagingProvider/EvolutionMessagingProvider, Channel/WhatsAppInstance, Conversation/Message/Attachment, credenciais por conexão e autorização de acesso.
3. WebhookEvent+OutboxEvent atômicos, dispatcher/leases/reconciliador e fila inbound; validar persistência antes de ack.
4. Inbound/status fora de ordem, dedupe de evento/mensagem e downloads privados com controles de upload/SSRF.
5. Outbound durável com rate limit/ordenação, idempotência suportada ou estado UNKNOWN/reconciliação/intervenção manual.
6. Socket.IO autenticado, rooms autorizadas, invalidações mínimas e refetch; UI de conversas funcional.
7. Failed jobs/falhas duráveis, métricas/alertas, shutdown e testes de crash/Redis indisponível.

Gate: webhook duplicado, inbound e outbound com retries/crash/timeout incerto cobertos; nenhuma perda de evento aceito no cenário validado, sem alegar exactly-once remoto. Troca de grants/sessão derruba acesso socket. Permissões de carteira não recebem payload de outra carteira. Capacidade de reconciliação real do fornecedor documentada; ausência é limitação explícita, não retry cego.

## Fase 9 — Produtos e tabelas de preço

1. Product, SKU, PriceList/Item e escopo organizacional/filial.
2. Validação decimal/moeda, arquivamento e telas necessárias.
3. Importação só se requisito: job com checkpoint, idempotência e relatório seguro de erros.

Gate: preços/uniques/tenant e tabelas de filiais testados; alterações em listas não mudam snapshots de documentos futuros. Não implementar estoque/ERP por inferência.

## Fase 10 — Orçamentos

1. Quote/Item, política de cálculo/arredondamento/moedas e snapshots de comprador/produto/preço.
2. Revisões imutáveis de versões aprovadas/enviadas, aprovação granular e audit.
3. Integração com oportunidade e fluxo UI; Idempotency-Key em criação/envio relevante.
4. PDF/entrega assíncrona só se solicitados, com storage privado e trabalho durável.

Gate: cálculo, descontos, snapshots após edição do catálogo, aprovação, concorrência e idem cobertos. Credenciais/sincronização ERP ficam para incremento específico após caso real; ERPProvider é limite definido, não implementação autorizada.

## Fase 11 — Automações

1. Conjunto pequeno de triggers/conditions/actions, sem execução de código arbitrário.
2. Definition versionada e snapshot na execução, steps/checkpoints e dedupe de origem.
3. Fila automations, timeouts, quotas, cancellation, guarda de ciclos e limite de profundidade/efeitos.
4. UI para configuração útil e histórico seguro de execuções.

Gate: automação real com retry/falha permanente/replay, troca de versão e limites testados; ação chama caso de uso autorizado, nunca repository de módulo alheio. Usuário/flow perde acesso → execução para ou falha de modo auditado.

## Fase 12 — Metas, dashboards e relatórios

1. Goal por tenant/filial/equipe/vendedor com períodos/fusos e métricas explícitas.
2. Dashboards com consultas/projeções medidas; `reports.branch/global` com scopes.
3. Exportações paginadas/assíncronas com ReportJob, quotas e artifact privado temporário.

Gate: totais corretos, desempenho demonstrado com dados sintéticos, relatório respeita tenant/carteira/filiais, pedido e download revalidam autorização. Materialização/réplica de leitura só mediante evidência.

## Fase 13 — IA

1. Definir caso de uso pequeno e humano revisável (ex.: sugestão de resumo/follow-up), dados permitidos e base legal.
2. AIProvider concreto, orçamento, timeout, rate limit, avaliação de qualidade e saída por schema.
3. Redação/minimização, testes de prompt injection e isolamento; nenhuma ferramenta com privilégio irrestrito.

Gate: custo/qualidade/segurança medidos, erro não altera dado comercial; sem envio autônomo de mensagem ou acesso a outros tenants. Não implantar plataforma de agentes genérica.

## Fase 14 — Hardening e produção

1. Auditoria de autorização completa (API/jobs/socket/uploads/exports), dependências, secrets, TLS, CORS/CSRF, segurança de imagens e restore.
2. Testes E2E críticos/carga/concorrência, migrations expand-contract, deploy compatível API/worker e rollback.
3. Monitoramento/alertas/runbooks, logs/traces redigidos e SLO/RPO/RTO definidos com o negócio.
4. Retenção LGPD/fiscal aprovada, eliminação/anonimização incluindo storage/fornecedores/backups e reaplicação após restore.
5. Recuperação de PostgreSQL/Redis/outbox/efeitos externos; definir HA gerenciada conforme disponibilidade exigida.

Gate: evidência de restore e reconciliação, incidentes simulados, limites por tenant, smoke de release e responsáveis operacionais definidos. Segurança, testes e observabilidade começam na fundação; esta fase consolida, não adia controles essenciais.

## Gates e riscos transversais

| Dependência/risco                                      | Momento de resolução                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| versões da stack/runtime e comandos ainda inexistentes | fase 1, antes de build/CI                                                    |
| usuário global vs membership, FKs compostas            | fase 2, antes de endpoints comerciais                                        |
| auth e escopos sem combinação indevida de grants       | fase 3, antes de exposição pública                                           |
| leases, retry, estado durável e reconciliação          | antes do primeiro job importante (fase 7 ou 8)                               |
| capacidades reais/credenciais da Evolution             | fase 8, antes de envio/webhook; valor secreto somente em configuração segura |
| política monetária/aprovação                           | fase 10, antes de quote aprovada                                             |
| SLA, retenção, bases legais e HA                       | refinados ao longo das features, obrigatórios antes de produção              |
| ERP não detalhado em requisitos                        | incremento separado, depois de contrato e processo comercial definidos       |

Cada conclusão exige evidência dos gates acima. As fases 0–5 estão encerradas. A fase 6 exige autorização explícita. Não antecipar os demais módulos comerciais.
