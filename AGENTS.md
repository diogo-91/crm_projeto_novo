# Guia para agentes e contribuidores

## Estado e objetivo

Este repositório inicia um CRM comercial multiempresa e multiloja. A fase 0 definiu os documentos. A fase 1 criou a fundação técnica. A fase 2 adiciona Organization, Branch, User global, OrganizationMembership e MembershipBranch, com API estrutural mínima local. A fase 3 implementa credenciais Argon2id, JWT curto, sessões/refresh rotativos e RBAC com escopos. A fase 4 adiciona design system, layout responsivo, páginas-base e integração web de sessão. A fase 5 implementa Contacts, Companies e Tags com escopos, carteira/filial, histórico mínimo de transferências e UI funcional. A fase 6 implementa leads, conversão transacional, pipelines/etapas configuráveis, oportunidades com histórico atômico e Kanban autorizado. A fase 7 implementa tarefas/follow-ups, interações/timeline e notificações privadas com lembretes duráveis. As fases 0–7, 9 e 10 estão concluídas; a fase 10 implementa orçamentos conforme ADR-018. A fase 8 tem somente ambiente local preparado; a integração CRM foi adiada enquanto a Evolution será instalada na VPS. A fase 11 exige nova solicitação. A exceção de endpoints administrativos públicos do ADR-011 foi encerrada pelo ADR-012. Consulte README.md para instalação e operação. Não confundir decisões planejadas com funcionalidades implementadas. Implementar somente a etapa explicitamente autorizada pelo solicitante; não antecipar telas, CRUDs, autenticação ou integrações.

Ler antes de alterar o projeto:

1. `ARCHITECTURE.md`: limites, fluxos, segurança e operação.
2. `DATABASE.md`: isolamento, relacionamentos, integridade e migrations.
3. `ROADMAP.md`: fases pequenas e critérios de conclusão.
4. `docs/adr/`: decisões e suas consequências.

Cada tarefa em nuvem já é isolada. Usar o checkout existente; não criar worktrees sem solicitação explícita. Preservar mudanças existentes. Por orientação explícita do usuário, ao concluir e validar alterações autorizadas, sempre criar commit e fazer push para o remoto configurado. Registrar no relatório o commit e a branch publicados; se houver bloqueio, informar a causa. Não incluir secrets, ambientes locais ou artefatos gerados. Deploy e migração de produção exigem autorização específica.

## Stack obrigatória

- Web: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form e Zod.
- Backend: NestJS, TypeScript, REST e Swagger/OpenAPI.
- Persistência: PostgreSQL e Prisma.
- Assíncrono: Redis e BullMQ. Realtime: Socket.IO.
- Infraestrutura: Docker e Docker Compose.
- Monorepo: pnpm e Turborepo.
- WhatsApp futuro: Evolution API através de `MessagingProvider` e `EvolutionMessagingProvider`.

Não adicionar tecnologias concorrentes nem escolher versões arbitrárias. Na fundação, verificar compatibilidade, fixar Node.js LTS suportado, pnpm via `packageManager`, versões das imagens e ferramentas, e registrar as escolhas. TypeScript em modo estrito. Antes de alterar código Next.js, consultar os guias da versão instalada em `apps/web/node_modules/next/dist/docs/`; o repositório mantém estas instruções centralizadas e desativa a geração automática de outros AGENTS/CLAUDE pelo Next.

## Estrutura do monorepo

```text
apps/
  web/                        # Next.js, páginas e features
  api/                        # NestJS: bootstrap HTTP e módulos
  worker/                     # bootstrap Nest standalone; jobs e módulos reutilizados
packages/
  database/                   # Prisma, migrations e infraestrutura de persistência
  contracts/                  # contratos públicos, tipos e schemas de fronteira
  ui/                         # componentes visuais sem domínio
  config/                     # validação de configuração e constantes técnicas
  eslint-config/              # regras comuns e restrições de imports
  typescript-config/          # configurações TypeScript
```

A árvore principal está implementada; criar conteúdo adicional somente quando tiver responsabilidade concreta. `apps/api/src/modules` abriga módulos com `application`, `domain`, `infrastructure` e `presentation` conforme a necessidade real. O worker pode importar **somente exports públicos dos módulos**, nunca controllers, bootstrap HTTP ou arquivos internos. A API não importa o worker. Se o reaproveitamento exigir um pacote backend no futuro, propor ADR; não criar agora um framework genérico de módulos.

## Comandos disponíveis

Executar na raiz após `pnpm install`, `pnpm env:init` e preparo da infraestrutura. Os comandos e seus pré-requisitos estão no README.md:

| Diretório | Comando                               | Finalidade                                                                |
| --------- | ------------------------------------- | ------------------------------------------------------------------------- |
| raiz      | `pnpm install --frozen-lockfile`      | instalar dependências fixadas                                             |
| raiz      | `docker compose up -d postgres redis` | serviços locais; não conectar produção                                    |
| raiz      | `pnpm dev`                            | Turborepo inicia web/API/worker                                           |
| raiz      | `pnpm build`                          | build e geração necessária em ordem topológica                            |
| raiz      | `pnpm lint` / `pnpm typecheck`        | análise estática                                                          |
| raiz      | `pnpm test`                           | testes unitários/HTTP técnicos e DOM frontend                             |
| raiz      | `pnpm test:integration`               | integração real com serviços/processos isolados, RBAC e fluxos comerciais |
| raiz      | `pnpm test:e2e`                       | build e jornadas web com Playwright/API/PostgreSQL/Redis isolados         |
| raiz      | `pnpm db:generate`                    | gerar Prisma Client                                                       |
| raiz      | `pnpm db:migrate:dev --name <nome>`   | criar migration em banco local descartável                                |
| raiz      | `pnpm db:migrate`                     | aplicar migrations revisadas no ambiente autorizado                       |
| raiz      | `pnpm db:seed`                        | marcador técnico e organização/filiais/usuário demo; seed idempotente     |

Scripts `db:*` usam Prisma 7.10, `packages/database/prisma.config.ts` e um único schema; os scripts da raiz preparam dependências/cliente necessários. Seed demo é restrito a desenvolvimento/teste; SEED_ADMIN_PASSWORD obrigatório. Não redefine senha existente. SEED_PLATFORM_PROVISIONING opt-in concede apenas organizations.create, separado de roles tenant e com validade de 24 horas. Verificar o `package.json` vigente antes de executar comandos. Nunca usar comandos destrutivos de banco contra uma URL desconhecida. Depois de qualquer implementação, informar comandos realmente executados, resultados, falhas, testes não executados e seus motivos. Não afirmar que documentação foi testada como aplicação.

## Regras obrigatórias de arquitetura

- Monólito modular, sem microserviços, Kubernetes, event sourcing, CQRS completo ou GraphQL.
- Controller recebe request, valida entrada, chama um caso de uso/service e devolve resposta. Nada de regra de negócio, acesso Prisma ou chamada externa no controller.
- Camada application coordena autorização, transações e portas. Domínio conserva invariantes e não conhece NestJS, HTTP, Prisma, Redis ou Evolution API.
- Camada infrastructure implementa portas. Nem toda operação requer interfaces/factories: introduzir portas nas fronteiras voláteis e nos pontos que precisam de teste substituível.
- Dependências entre módulos passam por contratos públicos mínimos. Proibido importar repositories ou modelos internos de outro módulo. `forwardRef` não é solução padrão para ciclos.
- O dono da entidade escreve seus dados. Leitura cruzada usa serviço público de consulta ou projeção de relatórios explícita e autorizada. Nenhum pacote `shared` de regras de todos os domínios.
- `packages/database` é infraestrutura; não é API pública de CRUD compartilhado. Seu acesso é exclusivo de infraestrutura backend. Web, contratos, UI e domínio não importam Prisma.
- O backend é a fonte de verdade. Validação e ocultação de botões no frontend não substituem autorização nem regras de negócio.
- Integrar fornecedores por portas: `MessagingProvider`, `StorageProvider`, `AIProvider`, `ERPProvider`, `EmailProvider`, apenas quando houver uso concreto. Não transportar payloads de fornecedores para o domínio.
- Não executar chamadas HTTP externas dentro de transações de banco. Não processar trabalho pesado na request de webhook.

## Segurança e escopo

- `User` é identidade global. `OrganizationMembership` define participação. `Branch`, `Team` e grants definem acesso; equipe não concede acesso automaticamente.
- Após a implementação de auth, operações de tenant exigem `TenantContext` validado pelo servidor: organização ativa, usuário, membership, permissões e escopos. Nunca aceitar `organizationId`, proprietário ou papel do body como autorização. A exceção histórica do ADR-011 terminou. Guards globais negam endpoints sem metadata de autorização explícita; somente health e fluxos de cookie identificados são públicos. Path é seleção, nunca autorização.
- RBAC usa `Role`, `Permission`, `RolePermission`, `UserRole`. Avaliar permissão e escopo **do mesmo grant**, com limitação às filiais autorizadas nos escopos OWN/BRANCH/BRANCH_SET. ORGANIZATION é concessão explícita para todo o tenant apenas nas ações daquele grant. Proibido `if role === ADMIN` como controle principal.
- Filtrar organização em queries, contagens, busca, exportação, cache, attachments, jobs, rooms Socket.IO e auditoria. UUID imprevisível não autoriza acesso.
- Reforçar relacionamentos tenant com FKs compostas; não conectar objetos de organizações diferentes. Não reescrever `organizationId` para transferir dados.
- Mapear campos de entrada explicitamente. Sem mass assignment de DTOs para Prisma. Escopos e role grants nunca podem ser concedidos acima da autoridade do concedente.
- Nunca armazenar senha em texto puro, tokens de sessão recuperáveis em banco, secrets em Git ou logs. Senhas com Argon2id; refresh tokens opacos armazenados por hash; access tokens curtos.
- Não gerar credenciais padrão de produção, relaxar TLS, desabilitar assertions, CORS irrestrito ou bypass de autorização para fazer testes passarem.
- Usar dados sintéticos nos testes. Não copiar dados reais de clientes nem payloads pessoais para fixtures.

## Convenções

- Documentação em português; identificadores, nomes de arquivos de código e contratos em inglês.
- Entidades/classes em PascalCase, variáveis/campos em camelCase, arquivos/pastas de código em kebab-case, tabelas/colunas SQL em snake_case via mapeamento Prisma.
- Pacotes `@crm/*`; módulos por capacidade; permissões `recurso.ação`; filas em kebab-case; eventos como `opportunity.stage_changed.v1`.
- Tempos em UTC no backend; valores monetários decimais, moeda explícita e nunca `number` para cálculos financeiros. Ver `DATABASE.md`.
- API `/api/v1`, DTOs explícitos, schemas Zod nas fronteiras; nenhum modelo Prisma exposto como resposta.
- Alterações públicas compatíveis por padrão; breaking changes exigem versionamento e ADR quando arquiteturais.

## Testes e migrations

Regras críticas têm testes unitários; queries, RBAC, transações e filas têm testes com PostgreSQL/Redis reais isolados; E2E cobre jornadas de API e web. Casos multiempresa, filiais, grants, duplicação de webhook, corrida, retry e envio incerto são obrigatórios. Suites precisam comprovar que testes executaram, sem zero-testes tratado como sucesso.

Migrations são versionadas e revisadas junto ao schema. Prisma gera alterações comuns; SQL manual revisado cria FKs/índices/checks que o schema não expressa. Não editar migration aplicada, usar `db push` em produção nem migrar ao iniciar cada réplica. Testar banco vazio e atualização da versão anterior. Mudanças destrutivas usam expand/contract com backfill monitorado. Revisar plano de rollback, backups e impacto dos locks antes de produção.

## Antes de concluir uma tarefa

Verificar limites dos módulos, isolamento por organização/filial, autorização do recurso, integridade referencial, concorrência, idempotência, compatibilidade de contratos, logs sem secrets e consultas com índices. Atualizar documentação e ADR quando uma decisão mudar. Não corrigir uma arquitetura por meio de dependência circular ou dependência nova sem necessidade comprovada.

No estágio atual, tarefas/timeline/lembretes, catálogo/preços e orçamentos estão implementados. O usuário autorizou a fase 9 independente da Evolution; somente o ambiente local da fase 8 foi preparado. Não iniciar integração CRM WhatsApp/Evolution, automações, envio de e-mail ou IA sem nova solicitação. Não usar any, supressões TypeScript/ESLint, monkey patch, erro silencioso, fallback de infraestrutura, peers forçados ou exclusão de apps do build para contornar problemas. Corrigir a causa, revalidar e documentar decisões em ADR.

## Fundação organizacional implementada

Organizations usa camadas domain/application/infrastructure/presentation; owns Organization, Branch e memberships. Users expõe UserIdentityGateway pelo index público; somente esse módulo persiste/projeta identidade global. O repository organizacional compartilha a transação técnica com o gateway, sem Prisma em domínio/application. Nunca associar uma identidade existente automaticamente por e-mail. Filial principal pertence à membership e aponta ao vínculo MembershipBranch. Preservar FKs compostas, uniques tenant+code/tenant+user e CHECKs de normalização, inclusive ao criar migrations futuras. Não usar `db push` para contornar esses CHECKs não expressos pelo Prisma.

## Autenticação e autorização implementadas (fase 3)

- Auth owns Session/RefreshToken; Users owns hash/securityVersion; Organizations owns contexto/memberships; AccessControl owns papéis/grants. OrganizationsContextModule é a interface pública de consulta sem controllers, evitando ciclos. Imports entre módulos somente por index público. PasswordModule possui Argon2id e é reutilizado pelo seed.
- Access JWT HS256 validado por JOSE; secret aleatório base64url de 32 bytes obrigatório. Claims mínimos sub/sid/cv/iat/exp/iss/aud. Toda autenticação consulta Session+User atuais; não existe cache de RBAC/sessões, blacklist Redis ou SUPER_ADMIN com bypass global.
- Session.contextVersion invalida access anterior na seleção de contexto; User.securityVersion invalida sessões concorrentes na troca de senha/logout-all. Refresh histórico por hash SHA-256, família por sessão, lock de sessão e revogação confirmada antes de lançar erro de reuso. Nunca lançar dentro da transação a exceção que desfaz a revogação.
- Senha 12–128 caracteres, sem trim/truncamento; Argon2id m=65536,t=3,p=1. Identidade estrutural pode continuar com hash nulo: não autentica. Seed é executado por bootstrap Nest standalone na API, usando gateways dos donos; packages/database guarda somente schema/client/migrations/configuração técnica.
- Cookie refresh HttpOnly/Lax/Path=/; Secure e __Host- em produção. Login/refresh/logout exigem Origin permitido e JSON. Bearer protege rotas comuns; cookie sozinho não autentica recursos. CORS explícito com credentials. Access fica em memória na web; nunca localStorage.
- Read models de segurança em AccessControl e Session fazem joins somente de leitura autorizados, documentados no ADR-012. Queries comerciais devem continuar usando interfaces públicas. Writes administrativos revalidam grants sob lock da membership; atribuição/remove ordenam locks ator/alvo.
- BRANCH_SET é o nome aprovado para MULTI_BRANCH. ALL existe apenas no PlatformGrant temporal; nunca em UserRole. A API não cria grants de plataforma nem modifica a própria atribuição de papel.
- Listas filtram tenant/escopo no SQL antes de paginação e reduzem metadados de filiais na projeção. Scope OWN para usuários lista somente a própria membership; diretório de filiais limita-se às filiais ativas vinculadas. Recursos comerciais futuros sem owner/branch continuam negados sem política explícita.
- Logs de segurança contêm IDs e tipo de evento, sem e-mail, cookie, senha, hash ou JWT. Rate limits Redis atômicos, falha 503; não criar fallback local.

## Frontend da fase 4

- Leia ADR-013 e docs/DESIGN_SYSTEM.md. Primitives/tokens ficam em packages/ui; não duplicar em apps/web/components/ui. Components.json registra o workspace shadcn/new-york. Usar tokens semânticos e Lucide.
- Páginas/layouts são Server Components; interação em components/layout, components/navigation e features/auth. Não serializar credenciais nem dados privados em RSC pelo gate de UX. Backend autoriza dados.
- ApiClient é a única camada fetch. SessionClient é o único proprietário de access em memória; AuthProvider/useSyncExternalStore só distribui estado. Refresh single-flight + Web Locks, BroadcastChannel sem tokens; não criar segunda implementação de auth/BFF/storage. Falhas de infraestrutura aparecem em estado de erro.
- Can/usePermission usa context.permissions do backend como indicação de ação, sem reproduzir scopes ou inferir permissões pelo papel. Mudança de membership/identidade cancela requests e descarta dados anteriores. TanStack Query já gerencia dados comerciais conforme ADR-009/014: keys com organização, membership e cacheScopeKey; Client descartado na troca de contexto. Access continua pertencendo somente a SessionClient.
- pnpm test inclui DOM frontend; pnpm test:e2e constrói e executa Playwright com API/PostgreSQL/Redis reais isolados. Requer Docker, Chromium e portas frontend/API livres. Pode usar PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH para browser instalado. No CI, instalar Chromium via Playwright. Não salvar traces/storageState com credenciais.
- Playwright usa somente seu projeto Compose descartável e remove seus próprios volumes. .runtime/browser-fixture.json é privado, 0600/ignorado e removido ao encerrar. Capturas .runtime são somente revisão local, nunca Git.

## Fundação comercial — fase 5

- Leia ADR-014. Contact/Company exigem branchId e ownerMembershipId; a FK composta aponta a MembershipBranch. Company é cliente B2B, nunca tenant. Não permitir owner User global nem associação entre organizações.
- Contacts consulta gateways públicos de Companies, Tags e Organizations. Queries/transações Prisma ficam nos repositories/gateways de infrastructure; não mover Prisma para controllers, application ou contratos.
- Toda ação comercial usa sua própria permission+scope. Reatribuição exige update e assign nas origens/destinos; filtro tenant/scope antecede keyset. Catálogo de tags é organizacional: read em grant válido, manage/ORGANIZATION.
- Contact usa unique tenant+normalizedPhone, sem inferir DDI; e-mails comerciais não são únicos. Documentos presentes são únicos por tenant e tipo de entidade, sem regras fiscais. Tag usa tenant+normalizedName. Alterar essas políticas exige documentar decisão e revalidar corridas.
- PATCH/DELETE exigem expectedVersion. DELETE desativa, preservando relações e chaves; transferências criam histórico mínimo na mesma transação. Não substituir essa integridade por logs, find-then-insert ou updates sem versão.
- API/web usam DTOs explícitos, Zod estrito e campos Prisma mapeados. Não aceitar campos internos nem substituir relações ocultas com NULL só porque a resposta omitiu seus detalhes.
- Listas e lookups são paginados, limite máximo 100. Projeções batched sem N+1; parâmetros de busca e sort são permitidos explicitamente. Interfaces não reimplementam scopes.
- cacheScopeKey é metadado servidor de grants/filiais para invalidar cache quando o contexto atualizado chega; não é credencial nem autorização. Contratos estritos exigem release coordenado API/web.
- Seed atualiza catálogo e templates da demo idempotentemente, sem criar clientes/empresas/tags fictícios e sem conceder privilégios globais a outros tenants. Migrations contêm somente estrutura/constraints.
- Fixtures e screenshots comerciais são sintéticos/isolados e ignorados pelo Git. Não antecipar módulos futuros, auditoria completa, eventos, filas comerciais ou outbox sem consumidor.

## Fundação de vendas — fase 6

- Leia ADR-015. Leads, Pipelines e Opportunities possuem seus dados; conversão usa gateways públicos e uma transação, sem repositórios alheios/ciclos. Criação HTTP e gateway compartilham a mesma implementação.
- Lead qualificado/ativo converte uma vez: lock+unique tenant/lead+hash da intenção; retry equivalente revalida autorização e devolve o mesmo resultado, intento diferente 409. Preserve a distinção entre relação omitida e null. Não associar cliente oculto por telefone/e-mail nem criar cadastros parciais.
- Pipeline é catálogo com filial opcional. Leitura tem política própria por grant; manage exige scope ORGANIZATION para a ação. Etapa kind imutável, pelo menos uma OPEN ativa, máximo 30, ordem por posição/UUID e reorder completo sob lock+Pipeline.version.
- Opportunity exige FKs tenant/filial/owner/pipeline/etapa, numeric(19,4) string e moeda explícita. PATCH não altera pipeline/status/etapa. Mover exige expectedVersion e grava estado/histórico atomicamente; LOST exige motivo, OPEN limpa fechamento. Históricos preservam nomes na ocorrência e paginam por recordVersion.
- Kanban carrega 25 oportunidades por coluna com scope no SQL, mutation autorizada/otimista/snapshot/rollback/refetch e ação por teclado equivalente a drag. Nunca usar lista parcial como total nem filtrar tenant apenas na web.
- Migrations continuam sem concessões globais de permissões. Seed atualiza somente demo; novos templates no provisionamento autorizado. Não criar outbox/filas sem consumidor nesta fase.
- Executar comandos de validação que geram/buildam packages em sequência: processos pnpm separados não coordenam escrita do Prisma Client entre si. Dentro de cada comando, o grafo Turborepo conserva dependências.

## Tarefas, timeline e lembretes — fase 7

- Leia ADR-016. Tasks possui Task/TaskHistory/TaskReminder; Activities possui interações imutáveis; Notifications possui avisos e marcação privada. TasksCore consulta gateways públicos Contacts/Leads/Opportunities; Activities agrega gateways Tasks/Opportunities. Não copiar movimentações para Activity nem criar eventos/outbox sem consumidor independente.
- Task exige filial e ownerMembershipId com FK a MembershipBranch. Alvo primário é zero ou um Contact/Lead/Opportunity; Activity exige exatamente um. Não usar entityType/entityId polimórfico, User global como proprietário ou relações de outro tenant.
- Tarefas e notificações intersectam leitura atual do alvo e tasks.read no SQL antes da paginação. Interações exigem activities.read/create no scope do mesmo grant e leitura do alvo. Caixa de notificações é sempre privada da membership; nenhum grant organizacional permite ler avisos de terceiros.
- PATCH/concluir/reabrir/arquivar exigem expectedVersion, revalidação de sessão/grants e lock da tarefa. TaskHistory é atômico, com autoria e versão única. Transferência exige update/assign na origem e destino. Não reescrever tenant ou substituir histórico por logs.
- Datas ISO exigem offset e persistem UTC; web usa o fuso do navegador, rejeita gaps de DST e envia intervalo do dia local em Hoje. Não truncar/reagendar datas não editadas: preservar segundos/milissegundos existentes. RemindAt exige dueAt e não pode ultrapassá-lo.
- TaskReminder é a intenção durável gravada na mesma transação da tarefa. Request não enfileira diretamente no Redis. ReminderVersion só muda para atribuição/alvo/datas/lifecycle, evitando duplicação por edição de título. Não adicionar OutboxEvent/EventReceipt genéricos para o mesmo efeito local.
- Worker exige DATABASE_URL, não JWT/sessão fictícia. Importa somente @crm/api/task-reminders e exports públicos runtime. Reconciliação 15s, batch 25, lease/token 60s, SKIP LOCKED, notifications concorrência 4, cinco tentativas e backoff/jitter limitado. Payload tem versão+ID, sem texto comercial. Notification+COMPLETED são atômicos e únicos por intenção/destinatário.
- Falhas duráveis e failed set são reais; retry exige tarefa atual autorizada, preserva identidade e horário. Invalid job falha permanentemente; stale/revogado cancela; duplicata antecipada não entrega nem consome tentativa. Não persistir Prisma/SQL brutos em failedReason nem registrar payloads/segredos. Logs usam IDs, tentativas, duração, stalled e métricas pending/failed/lag.
- Shutdown para aquisição e drena filas/consumidores antes de desconectar Prisma via onApplicationShutdown. Não encerrar conexão em onModuleDestroy antes de drenar o worker.
- Executar testes PostgreSQL/Redis/worker reais: scopes, FKs/IDOR, concorrência de conclusão, timeline paginada, seed/migration limpa, duplicação, Redis indisponível, lease sem job, cinco falhas reais e replay. Fault injection DDL somente no banco descartável de teste, com cleanup no finally. Nunca usar mock para ocultar infraestrutura quebrada.

## Catálogo — fase 9

- Leia ADR-017. CatalogModule owns Product/PriceList/PriceListItem; Prisma somente nos repositories, sem gateway/evento/ERP especulativo. CommercialDirectoryGateway publica branchLabels para projeção em lote sem buscar proprietários desnecessários.
- products.read é catálogo compartilhado por organização; products.manage exige ORGANIZATION. price-lists.read permite listas organizacionais e filiais do mesmo grant; OWN usa seus vínculos apenas na leitura. Gestão de lista organizacional exige ORGANIZATION; para filial exige price-lists.manage que cubra o destino. canManage e organizationAllowed são calculados no backend, apenas hints de UX; revalidar toda escrita. Permissão ampla de outra ação não empresta scope.
- SKU obrigatório trim/uppercase/ASCII e unique tenant inclusive arquivados; unidade de produto é fixa após a criação para não reinterpretar preços. Moeda e filial de lista também são imutáveis pela API. Valores de preço numeric(18,6), até 12 inteiros/seis decimais, strings sem float/câmbio; totais de oportunidade continuam numeric(19,4). Schemas monetários realmente compartilhados ficam em contracts/money.ts, preservando exports públicos anteriores.
- expectedVersion em todas as mudanças; preços pertencem ao agregado/version da lista. Lock de lista antes de itens e de produto ativo antes de preço; arquivamento de produto usa lock exclusivo. Unique/FK/CHECK são a autoridade de concorrência/integridade, não find-then-insert. Produtos/listas arquivados não aceitam edição; PUT reativa item explicitamente, sem apagar histórico de identidade.
- Listas e itens têm paginação limitada em SQL, sem count global/itens ilimitados no detalhe. Query keys web incluem tenant/membership/cacheScopeKey; invalidação se limita ao catálogo e às projeções de preços afetadas. Nunca mapear request inteiro para Prisma.
- A migration de catálogo `20261008140000_create_products_price_lists` permanece imutável. Seed idempotente não cria produtos/listas/preços fictícios nem amplia grants de tenants antigos por migration; permissões atuais estão na seção da fase 10.
- Fase 8 adiada. Catálogo não implementa estoque, importação, ERP, novos jobs/outbox ou messaging. Snapshots e arredondamento de orçamentos pertencem a Quotes/ADR-018.

## Orçamentos — fase 10

- Quotes owns Quote/Item/History/Request. Consultar compradores/catálogo/oportunidade somente por gateways públicos; nenhum write em tabelas alheias.
- Leia ADR-018 antes de alterar cálculo/status. Cálculo BigInt escalado, HALF_UP por linha e desconto sobre bruto arredondado; total soma centavos. Moedas atuais BRL/USD/EUR/GBP. Nunca usar float/number financeiro, aceitar total do cliente ou recalcular documento por mudança de catálogo.
- Snapshots são dados do documento. DRAFT editável somente em itens/quantidade/desconto/notas/validade; APPROVED inteiro e itens imutáveis via triggers. Revisão cria novo ID, root/previous e revision, sem sobrescrever aprovado ou bifurcar a série. Sem SENT/entrega fictícia.
- Criação/revisão exigem Idempotency-Key persistida na mesma transação. Retry revalida sessão/grants/action/scope/read. expectedVersion nas mudanças. QuoteHistory específico append-only é obrigatório por versão; não é audit universal/event sourcing.
- Owner é o criador na criação e preservado na revisão; filial e owner precisam de vínculo. Permissões quotes.read/create/update/approve, scope da mesma ação. Aprovação não ocorre por nome de papel e não implica envio/aceite.
- Migration `20261008180000_create_quotes` e CHECKs/triggers financeiros devem ser preservados. Seed demo/novo tenant tem 52 permissões, sem catálogo/propostas sintéticas; não ampliar grants de tenants existentes automaticamente.
- PDF/storage/ERP/envio/outbox só com solicitação e consumidor real. Nenhum novo serviço/env/dependência nesta fase.
