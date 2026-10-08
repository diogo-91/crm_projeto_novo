# CRM — fundação, autenticação e cadastros comerciais

Monorepo pnpm/Turborepo com web Next.js, API NestJS e worker Nest Application Context. A fase 2 acrescenta Organization, Branch, User global e memberships à infraestrutura existente. A fase 3 implementa autenticação e RBAC; todos os endpoints administrativos exigem sessão e autorização. A fase 4 implementa sessão web/layout/design system; a fase 5 adiciona clientes, empresas e tags funcionais. A fase 6 implementa vendas/pipeline; a fase 7 acrescenta tarefas, timeline e lembretes reais. A fase 9 adiciona produtos e tabelas de preços. A fase 8 teve somente ambiente local preparado; sua integração CRM foi adiada enquanto a Evolution será instalada na VPS. ADR-012 encerra a exceção de API aberta do ADR-011. Leia AGENTS.md e os documentos de arquitetura antes de contribuir.

## Requisitos

- Node.js **24.19.0** (arquivo `.node-version`), pnpm **11.19.0**.
- Docker Engine e Docker Compose v2 com suporte a `up --wait`.
- Portas locais 3000, 3001, 5432 e 6379 disponíveis; PostgreSQL/Redis não são publicados fora do loopback.

Instale a versão de pnpm indicada em `packageManager` com seu gerenciador de ferramentas ou `npm install -g pnpm@11.19.0`. Não use force/legacy-peer-deps. pnpm 11 utiliza `pnpm-workspace.yaml` para política de instalação, peers e builds nativos. O lockfile fixa a árvore; TLS/checksums permanecem habilitados.

## Primeiro início

Execute **na raiz do repositório**:

```bash
pnpm install --frozen-lockfile
pnpm env:init
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`env:init` cria `.env` com permissões 0600, senhas aleatórias e secret JWT de 32 bytes **exclusivamente para o desenvolvimento local**, sem imprimir valores. Recusa sobrescrever arquivo existente. Alternativa: copie `.env.example` para `.env` e preencha DATABASE_URL, POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET e SEED_ADMIN_PASSWORD; mantenha a senha da URL coerente com a do serviço PostgreSQL. Nunca use credenciais locais em produção ou faça commit de `.env`.

PostgreSQL e Redis rodam em Docker; web/API/worker rodam diretamente por pnpm, com compilação/watch. Turborepo compila dependências antes de iniciar cada consumidor; bibliotecas têm watch e API/worker usam tsc-watch, preservando metadata de decorators Nest. Não há container HTTP no worker e não existe serviço adicional de Evolution/storage/proxy.

`infra:up` espera **healthchecks reais** dos containers; ter container started não prova readiness da API. `pnpm dev` falha se configuração/dependências exigidas faltarem. Espere logs `API ready` e `worker ready`; não interprete o banner do runner como prova de startup.

### Endereços locais

| Recurso                      | Endereço padrão                         |
| ---------------------------- | --------------------------------------- |
| Aplicação web                | http://localhost:3000                   |
| API REST                     | http://localhost:3001/api/v1            |
| Resumo técnico               | http://localhost:3001/health            |
| Liveness                     | http://localhost:3001/health/live       |
| Readiness PostgreSQL + Redis | http://localhost:3001/health/ready      |
| Swagger UI                   | http://localhost:3001/docs              |
| OpenAPI JSON                 | http://localhost:3001/docs/openapi.json |

Estes endereços são instruções para executar o projeto **localmente**, não previews publicados do ambiente em nuvem. A aplicação possui login, clientes, empresas, tags, leads, oportunidades e pipelines. Outros módulos mantêm páginas-base claramente identificadas, sem métricas ou dados comerciais fictícios.

## Configuração

O parsing de processos está centralizado em `@crm/config/server` e o parsing público web em `@crm/config/web`. A API/worker validam ao inicializar; os erros listam nomes dos campos inválidos, nunca valores. Variáveis específicas da API, como JWT_SECRET, não são exigidas no worker. Desde a fase 7, DATABASE_URL é obrigatória para o worker de lembretes, além de Redis/BullMQ. `.env` é carregado uma vez pelos comandos da raiz via dotenv-cli; não há cópias do arquivo em cada aplicação.

| Variável                                        | Uso                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| NODE_ENV                                        | development/test/production; obrigatória para API/worker                                         |
| API_PORT                                        | porta da API, inteiro 1–65535                                                                    |
| DATABASE_URL                                    | PostgreSQL válido, requerido API, worker de lembretes e ferramentas Prisma                       |
| REDIS_HOST / REDIS_PORT                         | conexão Redis, obrigatórias API/worker                                                           |
| REDIS_PASSWORD                                  | opcional na biblioteca quando a instalação não exige senha; **obrigatória no Compose fornecido** |
| CORS_ORIGINS                                    | lista de origens HTTP(S) separadas por vírgula, sem path, slash final ou wildcard                |
| LOG_LEVEL                                       | trace/debug/info/warn/error/fatal; padrão info                                                   |
| NEXT_PUBLIC_API_URL                             | URL HTTP(S) pública, validada no config Next; nunca secrets                                      |
| POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD | bootstrap do container PostgreSQL                                                                |
| POSTGRES_PORT                                   | porta local publicada, padrão 5432                                                               |

Se alterar POSTGRES_PASSWORD depois de criar o volume, a imagem PostgreSQL não altera automaticamente a senha existente. Use procedimento SQL autorizado para alterar o usuário e a URL de forma coerente, ou recrie **apenas um volume local descartável** após confirmar que pode perder os dados. `infra:down` preserva volumes; não há reset destrutivo automático. Não imprima `docker compose config` ou ambientes completos com secrets em logs públicos.

## Banco, migrations e seed

Prisma está em `packages/database`, schema em `prisma/schema.prisma`, config em `prisma.config.ts`, migrations em `prisma/migrations`, client gerado/ignorado em `src/generated/prisma` e compilado com o pacote. Runtime Prisma 7 usa adapter PostgreSQL; a API possui um DatabaseService singleton gerenciado pelo Nest e um pool de no máximo cinco conexões. Não há client global improvisado.

As migrations da fase 1/2 são: `20261006130000_infrastructure_metadata` (preservada) e `20261006144000_create_organization_branch_user_foundation`. A segunda cria somente Organization, Branch, User, OrganizationMembership e MembershipBranch, com FKs compostas, uniques e CHECKs documentados em DATABASE.md. Não cria entidades comerciais, credenciais ou RBAC. A fase 3 adiciona `20261006180000_create_auth_sessions_rbac` e `20261006190000_enforce_grant_branch_reparenting`, preservando o histórico; a segunda reforça cardinalidade quando uma filial é movida entre grants por escrita direta. Readiness executa `SELECT 1`; a integração usa PostgreSQL real novo e verifica o histórico aplicado.

```bash
pnpm db:generate
pnpm db:migrate                   # migrate deploy: aplica migrations existentes
pnpm db:migrate:dev --name nome_da_mudanca  # somente banco local descartável
pnpm db:seed                      # dados demo + credencial via env e RBAC
```

Os comandos da raiz preparam o pacote config/cliente quando necessário. Não rodar `migrate dev`, reset ou `db push` em produção. Migrations não são executadas por startup da API/worker. Deployment/credenciais DDL de produção são responsabilidade de uma etapa operacional autorizada.

## Qualidade e testes

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:integration
```

- `lint`: ESLint tipado (promises, unsafe types, imports e Next/React hooks) e Prettier único.
- `typecheck`: strict, exact optional properties, unchecked indexes e demais configs compartilhadas; verifica também configuração/tooling.
- `test`: Vitest único com SWC preservando decorators/metadata, testes de config, contratos, logging, correlação, UI técnica, handler e HTTP Nest. Os testes HTTP usam doubles de dependência; não alegam conexão real.
- `test:integration`: cria projeto Compose **separado**, credenciais aleatórias, portas efêmeras e banco/volumes exclusivos. Aplica todas as migrations desde um banco vazio, repete deploy/seed, verifica idempotência e constraints multi-tenant, testa API estrutural/rollback/concorrência e paginação, sobe API/worker compilados como processos separados, verifica health/Swagger e job producer→worker. Pausa PostgreSQL/Redis individualmente, exige 503 de readiness e 200 de liveness, recupera sem reiniciar API e verifica shutdown. Remove apenas seus próprios containers/volumes/arquivos temporários.
- `build`: Turborepo ordena bibliotecas, API, worker e Next. Sem excluir aplicação para passar.

Docker deve estar disponível para integração. Falta de Docker/serviço é **falha**, não skip nem sucesso falso. Suites unitárias não precisam de containers; podem precisar compilar bibliotecas e gerar cliente a partir da configuração local. A integração não usa dados nem volumes de desenvolvimento. CI executa lint/typecheck/test/build e integração.

Para validar a fila manualmente, com o worker iniciado e builds concluídos:

```bash
pnpm queue:probe
```

A fila **foundation-probe** valida payload e devolve correlationId; não é endpoint público nem fila comercial. Retém até 100 resultados/falhas, concurrency 1 e retries exponenciais limitados. Seu objetivo é diagnóstico, sem efeito comercial e sem promessa de entrega durável/outbox. Não reaproveitar isso para mensagens reais sem ADR-007 e controles de tenant.

## Validação da fase 1 — histórico

Em 2026-10-06, passaram `pnpm install` (também instalação congelada), `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`, com todas as aplicações incluídas. Foram executados 38 testes unitários/HTTP e 8 de integração; nenhum teste ignorado. O smoke de `pnpm dev` verificou conteúdo SSR, CSS Tailwind, health/live/ready, Swagger UI/assets/OpenAPI e job técnico produzido pela API e processado pelo worker separado. A integração verificou migration/seed repetidos, 503 quando cada dependência é pausada, recuperação e shutdown com logs completos/código zero. Esses resultados validam desenvolvimento, não deploy de produção ou execução do workflow GitHub Actions.

## Operação básica e segurança

Logs JSON com timestamp, level, context, msg e correlação quando pertinente. Cada request recebe UUID requestId novo; X-Correlation-Id válido pode ser reutilizado (1–64 caracteres alfanuméricos, `_`/`-`), senão é substituído pelo requestId. Ambos retornam em headers; logs HTTP não contêm body/query/Authorization/cookies. Erros de infraestrutura são registrados sem URL/senha e `/health/ready` responde 503 com estados up/down. `/health/live` não consulta dependências. Swagger documenta health e as sete operações estruturais atuais, incluindo contratos Zod e erros seguros. Logs de criação contêm somente IDs estruturais/contexto; não contêm nomes, documentos ou e-mails.

Helmet aplica headers. CORS permite só origens configuradas com credentials=true. Auth/RBAC e Origin/JSON para cookies estão implementados conforme ADR-012; RLS, auditoria comercial e WebSocket permanecem nos marcos correspondentes. Este ambiente é de desenvolvimento, não deployment seguro de produção.

Ctrl+C/SIGTERM drena worker, fecha fila/client Redis e Prisma. Não depende de PID/porta para readiness. Para parar a infraestrutura sem apagar dados:

```bash
pnpm infra:down
```

Redis usa AOF/noeviction e volume; PostgreSQL 18 usa volume em `/var/lib/postgresql`, conforme layout da imagem. Imagens estão fixadas por digest. Backup/HA/restore/outbox comerciais exigem implementação e validação nas fases previstas.

## Execução em sandbox na nuvem

Em runtimes que não permitem gravar no diretório pessoal, use os diretórios XDG suportados pelo pnpm/compilador nativo, fora do checkout e sob `/tmp` com proteção sticky do sistema. Isso ajusta armazenamento local de ferramentas; não muda o aplicativo nem desativa verificação dos artefatos:

```bash
export XDG_DATA_HOME=/tmp/crm-runtime/data
export XDG_CACHE_HOME=/tmp/crm-runtime/cache
```

Na nuvem, o container hospedeiro desta tarefa usa PID 1 sem coleta de processos órfãos. O comando de startup utiliza o **Tini 0.19.0 já fornecido pelo Docker**, como subreaper, para supervisionar e recolher os descendentes do pnpm/Turborepo:

```bash
exec docker-init -s -- pnpm dev
```

Isso configura corretamente a supervisão do runtime Linux; não altera pnpm dev, código das aplicações ou sinais Nest. Foi validado startup/readiness e encerramento com um único Ctrl+C, sem timeout do supervisor. A saída 130 após Ctrl+C representa interrupção intencional da sessão; API/worker registram shutdown complete e a integração exige código zero quando recebem SIGTERM como processos próprios. Em sua máquina normal, use pnpm dev com o init do sistema; os ajustes XDG/subreaper não são necessários. Se o sandbox mapear a raiz do filesystem para outro proprietário, o SWC pode rejeitar a cadeia de confiança mesmo com XDG correto. Nesse caso executar ferramentas nativas no runtime real pelo mecanismo de permissões suportado pelo ambiente; não alterar proprietário da raiz, patchar o addon ou desabilitar sua verificação. O `.env` local é privado e não acompanha clones/snapshots compartilhados por Git; cada pessoa inicializa suas credenciais. Consulte `docs/adr/ADR-010-fundacao-tecnica.md` para matriz e decisões de implementação.

## Organização e identidade — endpoints agora protegidos

Seed usa bootstrap Nest standalone da API e gateways dos donos, é transacional/idempotente, exclusivo para desenvolvimento/testes, e recusa NODE_ENV=production. Cria marcador foundation/versão 1, Organização demo, Loja 1/LOJA_1, Loja 2/LOJA_2, Loja 3/LOJA_3, Tatuí/TATUI e Votorantim/VOTORANTIM. Cria `admin.demo@example.test` com nome Administrador demo, uma OrganizationMembership, cinco MembershipBranch e Loja 1 como principal. Na fase 3 esse usuário recebe senha somente via SEED_ADMIN_PASSWORD e grant ADMIN/ORGANIZATION na organização demo. Identidades criadas via API permanecem estruturais sem senha até provisionamento legítimo. Repetir não duplica nem sobrescreve perfis/desativações existentes.

User tem identidade/e-mail global; a participação organizacional e a filial principal ficam no membership. Para vincular uma identidade já existente, informar seu UUID no endpoint memberships. Não cadastrar novamente ou associar automaticamente por e-mail. Código de filial é uppercase/único por organização. Documento opcional normaliza pontuação de apresentação sem validação fiscal ou unicidade global sem país/emissor. Organização, usuário ou filial inativos bloqueiam novas associações; listagens podem mostrar inativos para inspeção. Não há endpoint de alteração/desativação nesta fase.

| Método | Caminho (prefixo `/api/v1`)                | Resultado                                            |
| ------ | ------------------------------------------ | ---------------------------------------------------- |
| POST   | /organizations                             | 201, organização criada                              |
| GET    | /organizations/:id                         | 200, organização                                     |
| POST   | /organizations/:organizationId/branches    | 201, filial criada                                   |
| GET    | /organizations/:organizationId/branches    | 200, lista paginada de filiais                       |
| POST   | /organizations/:organizationId/users       | 201, identidade nova + membership na mesma transação |
| GET    | /organizations/:organizationId/users       | 200, memberships paginados com identidade pública    |
| POST   | /organizations/:organizationId/memberships | 201, vínculo explícito de identidade existente       |

Listas: `?limit=25&cursor=<uuid>` (1–100 itens, cursor opcional), ordenadas por UUID crescente, retornam `{data,pageInfo:{nextCursor,hasNextPage}}`. Ordenação é estável, não cronológica. Bodies rejeitam propriedades extras. Invalid input → 400; recurso inexistente/filial de outro tenant → 404; unique/inativo → 409. Erros RFC 9457 incluem code e requestId sem payload sensível/SQL. Requests/responses estão no Swagger. O frontend não mudou.

Exemplo local (depois de instalar, migrar e iniciar o ambiente):

Cada operação exige Bearer e TenantContext validado. Path não concede acesso. GET organização exige organizations.read/ORGANIZATION; criação de filiais exige branches.manage/ORGANIZATION; identidades/memberships exigem users.manage/ORGANIZATION. Listas exigem branches.read ou users.read com filtro de escopo no banco. POST organizações exige a capacidade de plataforma explícita, não o papel ADMIN tenant.

## Validação da fase 2 — histórico

Em 2026-10-06, passaram instalação congelada, lint, typecheck, test, test:integration e build completo via Turborepo. São **88 testes: 52 unitários, 9 HTTP com dependências controladas e 27 de integração com PostgreSQL/Redis reais**; estes últimos incluem 12 cenários HTTP organizacionais, constraints, isolamento estrutural, concorrência, migration limpa e seed idempotente. A cobertura da fase 1 foi mantida. Seed em NODE_ENV=production falha com código não zero, sem alterar dados. PostgreSQL indisponível causa 500 seguro nas queries estruturais, além de readiness 503, sem mascarar a falha.

O banco local que continha apenas a migration técnica recebeu a segunda migration sem reset; seed foi executado duas vezes. O smoke pnpm dev iniciou API, worker e frontend, validou health/live/ready, Swagger/OpenAPI, consultas da organização demo/cinco filiais/membership e o job técnico producer→worker. O frontend manteve a página técnica. CI existente já executa os comandos e a suite ampliada; o workflow remoto não foi executado nesta sessão. Essa validação comprova desenvolvimento local e integridade referencial, não autorização HTTP ou prontidão de produção.

## Auth e RBAC — fase 3

Variáveis novas (validadas apenas onde necessárias):

| Variável                   | Regra                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| JWT_SECRET                 | obrigatório para API; 32 bytes aleatórios, base64url canônica (43 caracteres); sem default               |
| JWT_ISSUER / JWT_AUDIENCE  | crm-api / crm-web por padrão; devem coincidir nos emissores/verificadores                                |
| ACCESS_TOKEN_TTL_SECONDS   | 900 padrão; permitido 60–900                                                                             |
| SESSION_TTL_SECONDS        | 2592000 padrão; permitido 3600–2592000; prazo absoluto                                                   |
| AUTH_LOGIN_IP_LIMIT        | 30/min por IP, 1–10000                                                                                   |
| AUTH_LOGIN_IDENTITY_LIMIT  | 5/5min por IP+hash do e-mail normalizado, 1–1000                                                         |
| AUTH_REFRESH_IP_LIMIT      | 60/min por IP, 1–10000                                                                                   |
| SEED_ADMIN_PASSWORD        | obrigatório somente no seed local/teste; 12–128 caracteres; nunca embutido                               |
| SEED_ADMIN_EMAIL           | admin.demo@example.test padrão; identidade normalizada                                                   |
| SEED_PLATFORM_PROVISIONING | false padrão; true concede somente organizations.create por 24h com motivo; nenhum acesso global a dados |

Para um clone novo, pnpm env:init gera secrets privados e aleatórios. Para instalação existente, preencha as novas variáveis em .env sem mudar as senhas PostgreSQL/Redis já usadas pelos volumes. Secrets da API não são exigidos nem enviados ao worker. Argon2id 0.45.1 e JOSE 6.2.12 são compatíveis com Node 24; não há adaptador JWT concorrente, pacote cookie-parser ou fornecedor de e-mail antecipado. pnpm allowBuilds autoriza o addon oficial Argon2.

Seed não redefine senha existente nem duplica roles/permissões/grants. Para trocar senha use o endpoint autenticado; senha demo só existe em desenvolvimento/testes e seed recusa production. Templates tenant: ADMIN, DIRECTOR, SALES_MANAGER, SELLER, AFTER_SALES, VIEWER. Catálogo atual de 34 permissões implementadas: oito estruturais, doze comerciais da fase 5 e quatorze da fase 6. Não existe SUPER_ADMIN global. Para validar criação de novas organizações localmente, habilite SEED_PLATFORM_PROVISIONING=true antes do seed; não transforma ADMIN em administrador de outros tenants.

| Método/rota sob /api/v1                                                             | Proteção/efeito                                                                     |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| POST /auth/login                                                                    | Origin/JSON e limites Redis; e-mail/senha, cookie refresh, access e contexto seguro |
| POST /auth/refresh                                                                  | Origin/JSON e limite Redis; cookie, body {}; rotação atômica                        |
| POST /auth/logout                                                                   | Origin/JSON, cookie, body {}; revoga somente sua sessão, limpa cookie               |
| POST /auth/logout-all                                                               | Bearer, body {}; revoga todos os dispositivos                                       |
| GET /auth/me                                                                        | Bearer; identidade/contexto seguros                                                 |
| POST /auth/context                                                                  | Bearer + organizationId; verifica membership, invalida access antigo da sessão      |
| POST /auth/change-password                                                          | Bearer + currentPassword/newPassword; revoga todas as sessões, limpa cookie         |
| GET /organizations/:organizationId/roles                                            | roles.read/ORGANIZATION                                                             |
| GET /organizations/:organizationId/permissions                                      | roles.read/ORGANIZATION; catálogo implementado                                      |
| POST /organizations/:organizationId/memberships/:membershipId/roles                 | users.manage/ORGANIZATION, sem autoatribuição/escalada                              |
| DELETE /organizations/:organizationId/memberships/:membershipId/roles/:assignmentId | mesma política; 204                                                                 |

Login/refresh/logout precisam do header Origin exatamente em CORS_ORIGINS e Content-Type application/json, inclusive no Swagger/CLI. Para usar Try it out nos fluxos de cookie, sirva o Swagger pela origem permitida de publicação ou configure explicitamente sua origem local; nenhuma origem extra é habilitada implicitamente. Refresh não vai no body; cookie HttpOnly/Lax/Path=/ e Secure/__Host-crm-refresh em produção. Desenvolvimento usa crm_refresh sem Secure para HTTP local. O plano de publicação é mesma origem por proxy TLS; não usar SameSite=None ou Domain amplo para contornar configuração incorreta.

Access JWT (HS256, issuer/audience/typ/exp/iat validados) fica em memória no cliente futuro; não localStorage. Session e grants são relidos no banco a cada autorização. Uma membership ativa é auto-selecionada somente quando única; com várias, context=null e seleção obrigatória. Troca de contexto invalida access anterior do mesmo dispositivo. Logout, troca de senha, inativação e revogação de grants têm efeito imediato. Refresh expira com a sessão em até 30 dias, registra só hash e histórico. Reuso inclusive concorrente revoga família; o cliente futuro deverá coordenar refresh single-flight. Perda de resposta pode exigir novo login.

Escopos OWN, BRANCH, BRANCH_SET (equivalente a MULTI_BRANCH), ORGANIZATION; ALL só no PlatformGrant temporal. Recursos sem owner/branch exigem política explícita. Role assignment valida filiais ativas do alvo, tenant de role/membership e autoridade de quem concede; não permite alterar a própria membership. Constraints compostas e triggers protegem integridade mesmo em escrita direta. Coleções filtram antes de paginação e projeções ocultam filiais não autorizadas.

Erros: 400 validação, 401 credencial/sessão, 403 autorização/Origin, 404 recurso fora do contexto ou inexistente, 409 conflito, 429 limite com Retry-After, 503 rate limiting indisponível; erros inesperados são 500 seguros. Redis não possui fallback em memória; PostgreSQL é obrigatório para autenticação/autorização. Sem confiança em X-Forwarded-For até configuração autorizada de proxy. Logs de segurança contêm eventos e IDs sem senha, token, e-mail, URL do banco ou cookie.

Exemplo local executável sem imprimir credenciais ou JWT (API iniciada):

```bash
node --env-file=.env --input-type=module <<'JS'
const base = `http://localhost:${process.env.API_PORT}/api/v1`;
const response = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: process.env.CORS_ORIGINS.split(',')[0] },
  body: JSON.stringify({ email: process.env.SEED_ADMIN_EMAIL ?? 'admin.demo@example.test', password: process.env.SEED_ADMIN_PASSWORD }),
});
if (!response.ok) throw new Error(`Login HTTP ${response.status}`);
const auth = await response.json();
const me = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
if (!me.ok) throw new Error(`Me HTTP ${me.status}`);
console.log({ login: response.status, me: me.status, organizationSelected: auth.context !== null });
JS
```

Sem frontend de login, envio de e-mail, reset parcial, verificação de e-mail ou recursos comerciais nesta fase. Essas exclusões seguem a solicitação explícita e não são substituídas por tokens fake. Health/docs permanecem públicos técnicos; **nenhum endpoint administrativo é público**.

## Validação da fase 3

Em 2026-10-06, passaram install congelado, lint, typecheck, test, test:integration e build completo. **140 testes: 75 unitários, 10 HTTP de fundação com dependências controladas e 55 integrações com PostgreSQL/Redis reais**. As integrações preservam os 27 cenários anteriores e adicionam 28 de auth/RBAC/segurança, incluindo token roubado/reuso, refresh concorrente, senha versus login/refresh, sessões independentes, Origin/cookies, JWT inválido/expirado, inativos, IDOR, OWN/BRANCH/BRANCH_SET/ORGANIZATION, grants mistos, escalada, limites concorrentes e integridade direta no banco.

Migrations aplicadas do zero e novamente sem alterações; seed executado repetidamente, sem duplicar roles/permissões/grants nem redefinir senha. A atualização do banco local preservou dados da fase 2. Smoke pnpm dev verificou frontend e Tailwind, API/health/Swagger/assets/OpenAPI, proteção administrativa, login/me, rotação/reuso, worker e job técnico. Logs conferidos sem secrets. Encerramento supervisionado intencional devolveu 130 para Ctrl+C; os processos de integração mantêm shutdown controlado com código zero. O CI existente executa a suite ampliada; workflow remoto não foi executado nesta sessão. A validação comprova o ambiente local autorizado, sem alegar deploy de produção.

## Interface e sessão web — fase 4

Após os mesmos requisitos, pnpm install --frozen-lockfile, pnpm env:init (somente clone novo), pnpm infra:up, pnpm db:migrate e pnpm db:seed, execute pnpm dev. A web usa /login e redireciona / para /dashboard. Utilize o e-mail do seed (padrão admin.demo@example.test) e a senha privada SEED_ADMIN_PASSWORD do .env; nunca copie credenciais para Git/logs. O seed não redefine senhas já existentes. API/worker/health/Swagger preservam os comandos e URLs anteriores.

CORS_ORIGINS deve conter exatamente a origem da web; NEXT_PUBLIC_API_URL aponta ao prefixo /api/v1. Em desenvolvimento, use localhost de forma consistente na web/API para cookies SameSite, sem alternar para 127.0.0.1 no navegador. Produção mantém publicação por uma origem TLS conforme ADR-008; não há deploy nesta tarefa. O navegador precisa suportar Web Locks/BroadcastChannel em origem segura; localhost é aceito. Não ler cookie HttpOnly, armazenar tokens em storage ou flexibilizar CORS.

Login/refresh/logout/context usam a API real. Uma membership ativa escolhe contexto automaticamente; várias exigem seleção. Sidebar recolhível salva somente preferência visual local. Cmd/Ctrl+K navega páginas; menu do usuário encerra a sessão no backend. Recarregar restaura por refresh single-flight, também coordenado entre abas. Perda da resposta de rotação pode exigir novo login; erros de infraestrutura não são mascarados.

Design system em docs/DESIGN_SYSTEM.md e decisões em ADR-013. Todas as rotas do menu são bases visuais, sem funcionalidades comerciais; Configurações inclui uma demonstração técnica isolada de componentes, sem painel administrativo.

Testes adicionais:

```bash
pnpm test
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

Vitest DOM cobre UI, validação, estado e cliente HTTP. test:e2e executa build e inicia API/web de produção local com PostgreSQL/Redis novos, migrations/seed e memberships A/B próprias. Não reutiliza nem modifica o banco de desenvolvimento. Pare pnpm dev antes: web 3000 e a porta de NEXT_PUBLIC_API_URL devem estar livres. O runner exige URL de API loopback terminada em /api/v1. Remove somente volumes do projeto crm-browser-* ao encerrar. A fixture temporária privada fica em .runtime (ignorado) e é apagada; traces/storageState/screenshots de falhas ficam desativados para não persistir credenciais.

Em ambiente com Chromium já instalado, alternativamente:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:e2e
```

A configuração oficial executablePath seleciona esse browser, sem alterar Playwright ou dependências. Na nuvem, use o supervisor docker-init -s documentado para a execução prolongada. Testes avaliam 375/768/1024/1440/1920px, axe, teclado/overlays, login/logout/refresh/revogação, todas as rotas e troca ADMIN A → VIEWER B. Respostas HTTP 401 de refresh sem cookie são esperadas na entrada de visitante; erros de aplicação/hydration são falhas.

## Validação da fase 4

Em 2026-10-06, passaram install congelado, lint, typecheck, test, test:integration, build de todos os apps/pacotes e test:e2e. **197 testes: 118 unitários (incluem 44 frontend/DOM), 10 HTTP, 55 integrações PostgreSQL/Redis e 14 E2E**. Todos os testes anteriores foram preservados. Canal BroadcastChannel nativo cobre comunicação com outra aba sem receber o próprio evento. Browser real valida concorrência de refresh/abas, isolamento de capacidades A/B, revogação, teclados/dialogs, rotas, 404, fonte Geist carregada e axe. Login, Dashboard, Configurações e navegação passaram nas cinco larguras, sem overflow global, erros de aplicação ou hydration. Somente o 401 esperado de refresh de visitante é reconhecido por mensagem e URL exatas.

pnpm dev foi executado com os volumes existentes: PostgreSQL/Redis saudáveis, quatro migrations sem pendências e seed preservando credenciais. Health/live/ready, Swagger/OpenAPI, login do admin demo, refresh, logout, Ctrl+K e processamento pelo worker separado passaram. Artefatos públicos não contêm os secrets do servidor; .env permanece privado/ignorado e fixtures E2E foram removidas. Nenhuma migration ou funcionalidade comercial adicional. O CI preserva seus checks e adiciona Playwright/Chromium; sua execução remota não foi verificada nesta sessão. Esta evidência encerrou a fase 4; a fase 5 foi autorizada e implementada posteriormente, conforme seção abaixo.

## Clientes, empresas e tags — fase 5

Após os comandos do primeiro início, use o admin demo configurado no `.env` para acessar `/contacts`, `/companies` e `/settings/tags`. O seed **não preenche esses cadastros**: o estado inicial é vazio e formulários escrevem na API real. Sem novos serviços/envs. As migrations comerciais são `20261007120000_create_contacts_companies_tags` e `20261007123000_create_assignment_history`, totalizando seis no histórico. Atualize um banco local existente com `pnpm db:migrate` e `pnpm db:seed`; não resetar o volume. Seed repetido preserva IDs, credenciais e dados, e amplia templates apenas da demo. Outros tenants existentes não recebem privilégios por migration.

Contact e Company pertencem a uma organização, têm filial e responsável OrganizationMembership obrigatórios. O owner precisa possuir vínculo com aquela filial. Company é cliente B2B; não representa Organization. OWNER não é User global. Consulte ADR-014 para matriz dos seis templates, constraints, scope, normalização e consequências. ADMIN tem CRUD/assign e gestão de tags; DIRECTOR/SALES_MANAGER não têm delete; SELLER não transfere carteira; AFTER_SALES não cria; VIEWER somente lê. Esses nomes não autorizam por si: scopes vêm dos grants reais.

Telefone de Contact é obrigatório e único por tenant após normalização, inclusive desativados. Preserve `+`/DDI quando conhecido: o sistema não acrescenta DDI brasileiro nem considera automaticamente equivalente um número local. E-mails comerciais podem ser compartilhados; documentos presentes são únicos por tenant/tipo, sem validação fiscal. Company permite telefone compartilhado. Tag é catálogo organizacional, com nome único e variante semântica; leitura exige tags.read, gestão exige tags.manage/ORGANIZATION.

### Endpoints comerciais

Todos usam base `http://localhost:3001/api/v1`, bearer válido e contexto atual. Não enviar organizationId no body/query. Swagger documenta requests, responses, filtros e erros reais.

| Método e caminho                                                 | Ação/semântica                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| POST /contacts                                                   | contacts.create; contacts.assign se atribuir outra membership          |
| GET /contacts                                                    | contacts.read, tenant/scope antes da keyset                            |
| GET /contacts/:id                                                | contacts.read no objeto                                                |
| PATCH /contacts/:id                                              | contacts.update; assign na transferência; expectedVersion obrigatório  |
| DELETE /contacts/:id                                             | contacts.delete; desativação, expectedVersion no body, 200 com DTO     |
| POST /companies                                                  | companies.create; companies.assign para outra membership               |
| GET /companies                                                   | companies.read com tenant/scope                                        |
| GET /companies/:id                                               | companies.read no objeto                                               |
| PATCH /companies/:id                                             | companies.update; assign na transferência; expectedVersion obrigatório |
| DELETE /companies/:id                                            | companies.delete; desativação, expectedVersion no body, 200 com DTO    |
| GET /contacts/assignment-branches, /contacts/assignment-owners   | lookup paginado autorizado por action=read/create/update               |
| GET /companies/assignment-branches, /companies/assignment-owners | mesma política, owners exige branchId                                  |
| GET /tags                                                        | tags.read; catálogo exclusivamente do tenant atual                     |
| POST /tags                                                       | tags.manage/ORGANIZATION                                               |
| PATCH /tags/:id                                                  | tags.manage/ORGANIZATION e expectedVersion                             |
| DELETE /tags/:id                                                 | tags.manage/ORGANIZATION; desativa com expectedVersion                 |

Listas seguem o padrão existente `{data,pageInfo:{hasNextPage,nextCursor}}`, sem total/global ou offset. `limit` padrão 25/máximo 100. Contact/Company aceitam sort=name/createdAt/updatedAt, direction=asc/desc e cursor opaco; preserve a ordenação ao usar nextCursor. Cursor UUID em tags/diretórios. A web mantém filtros/cursor na URL e navega anterior/próximo sem inventar totalPages.

Filtros de contatos: search (nome, telefone, e-mail, documento), branchId, ownerMembershipId, companyId, tagId, source e active. Empresas: search (nome/razão social, telefone, e-mail/documento), document exato, branchId, ownerMembershipId e active. Tags: search/active. Filtros de scope não são substituídos por opções de tela; empresa associada fora da autorização não é projetada e não pode ser consultada pelo filtro companyId. Detalhe de Company lista contatos pelo endpoint normal, preservando scope próprio.

PATCH parcial mantém campos/associações omitidos. Desativação não libera telefone/documento/tag para recadastro e não apaga ContactTag/Company. Conflito por unique ou expectedVersion responde 409; formulário mantém entrada para correção/recarregamento. Transferências gravam histórico mínimo atomicamente, sem AuditLog completo ou timeline. Erros seguem Problem Details, sem SQL, hashes, stack ou constraint interna.

TanStack Query usa a camada SessionClient existente; query keys incluem organização/membership/cacheScopeKey. O hash do contexto é fornecido pelo servidor e muda ao atualizar grants/filiais; uma nova resposta de sessão descarta o cache anterior quando ele muda. Não autoriza request nem substitui consultas de segurança. API/web possuem contratos estritos e devem ser lançadas juntas nesta alteração. Tokens e cache privado nunca são persistidos.

### Validação da fase 5

Os testes incluem normalização, payloads estritos, defaults de PATCH, scopes por ação, cache e componentes web; PostgreSQL real valida migrations limpas, seed repetido, FKs cruzadas, CRUD, permissões, concorrência, histórico/rollback e plano de query com 2000 registros. Browser real percorre empresa/tag/cliente, associação, edição, busca, desativação, duplicação, mudança de tenant e logout. Acessibilidade e overflow são avaliados em 375/768/1024/1440/1920px.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

Instale o browser por `pnpm exec playwright install --with-deps chromium` ou use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` conforme a instalação local documentada na fase 4. Integração/E2E usam projetos Compose próprios e removem só seus bancos/fixtures. Nenhum fluxo comercial depende de dados mockados no ambiente principal. Não há leads, pipeline, importações, WhatsApp, automações, dashboards reais ou IA nesta fase.

Evidência final de **2026-10-07**: todos os comandos acima passaram. **270 testes**: 161 unitários (58 frontend/DOM incluídos), 10 HTTP, 79 integrações e 20 E2E; nenhum cenário anterior removido. Instalação limpa com seis migrations e seed repetido passou nos bancos isolados. O banco local anterior recebeu as duas migrations novas; repetição do seed preservou IDs/vínculos e manteve zero Contact/Company/Tag. pnpm dev iniciou os três processos: health/live/ready, Swagger/OpenAPI comercial, login/contexto/logout, listas autenticadas e job técnico pelo worker passaram. Browser em desenvolvimento confirmou clientes, empresas e tags, sem erros de console/hydration. Logs e 28 artefatos públicos foram conferidos sem secrets do servidor; .env permanece 0600/ignorado. O CI existente executa as suites ampliadas sem retirar checks; execução remota não foi verificada nesta sessão. Esta é a evidência histórica da fase 5; a conclusão da fase 6 está registrada abaixo.

## Leads e pipeline — fase 6

Após atualizar o banco com `pnpm db:migrate` e executar `pnpm db:seed`, entre com o admin demo. O banco começa sem leads/pipelines/oportunidades fictícios. Em `/pipeline`, crie um pipeline com ao menos uma etapa aberta; configure nomes, ordem e ativação das etapas. As etapas possuem resultados Aberta/Ganha/Perdida, fixos após criação. Pipeline pode ser organizacional ou de uma filial; catálogo e dados comerciais continuam protegidos pelos scopes reais.

Em `/leads`, cadastre o interesse, filial e responsável. Abra a ficha, edite Qualificação para Qualificado e use Converter lead. Selecione pipeline/etapa aberta, valor decimal em string e moeda. Criação de cliente exige telefone; criação de empresa exige nome da empresa prospectada. Também pode selecionar registros existentes visíveis; não existe associação automática por telefone. Conflito gera rollback completo, e retries iguais retornam a mesma oportunidade. Lead convertido não pode ser editado novamente.

`/crm` lista oportunidades, `/crm/[id]` mostra ficha e histórico ordenado. Em `/pipeline`, arraste ou use Mover para confirmar o destino; uma etapa Perdida exige motivo. Movimentações para etapa aberta reabrem a oportunidade; ganhas/perdidas possuem fechamento. O Kanban pagina 25 itens por coluna, permite carregar mais e mantém filtro de filial/responsável/busca no servidor. Nenhum total é inferido de uma página parcial. Falhas/conflicts revertem a atualização otimista e refazem leitura. Configuração do pipeline usa a versão do pipeline; oportunidade usa sua própria versão.

Endpoints implementados sob `/api/v1` (sessão Bearer + contexto + permission/scope):

| Recurso                    | Rotas                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Leads                      | POST/GET `/leads`; GET/PATCH/DELETE `/leads/:id`                                                           |
| Atribuição de lead         | GET `/leads/assignment-branches`; GET `/leads/assignment-owners` com action                                |
| Conversão                  | POST `/leads/:id/convert`                                                                                  |
| Pipelines                  | POST/GET `/pipelines`; GET/PATCH/DELETE `/pipelines/:id`                                                   |
| Etapas                     | POST `/pipelines/:id/stages`; PATCH `/pipelines/:id/stages/:stageId`; POST `/pipelines/:id/stages/reorder` |
| Oportunidades              | POST/GET `/opportunities`; GET/PATCH/DELETE `/opportunities/:id`                                           |
| Atribuição de oportunidade | GET `/opportunities/assignment-branches`; GET `/opportunities/assignment-owners` com action                |
| Movimentação               | POST `/opportunities/:id/stage`                                                                            |
| Histórico mínimo           | GET `/opportunities/:id/stage-history` paginado por recordVersion                                          |

POST de recurso retorna 201; conversão, movimentação e mudanças de configuração de etapas retornam 200. PATCH/DELETE/ações exigem expectedVersion; DELETE desativa/arquiva sem apagar relações. Pipeline não muda no PATCH da oportunidade. Dados monetários aceitam até 15 dígitos inteiros e quatro decimais; BRL/USD/EUR/GBP são as moedas suportadas inicialmente. Não há conversão cambial ou cálculo financeiro por number. Swagger `/docs` documenta contratos reais e erros 400/401/403/404/409.

Migration nova: `20261007150000_create_leads_pipelines_opportunities`, total sete. Preserve os volumes existentes e o histórico aplicado. Catálogo passa a 34 permissões (oito estruturais, doze da fase 5, quatorze da fase 6); consulte ADR-015 para matriz. Seed atualiza templates **apenas na organização demo**; tenants anteriores fora da demo precisam de concessão explícita pelo mecanismo administrativo existente. Nenhuma migration amplia grants automaticamente.

As validações continuam `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm test:e2e`. Integração usa PostgreSQL/Redis descartáveis e aplica toda a cadeia; browser usa API real. Sem nova dependência, serviço ou variável de ambiente. Não implementa fase 7 ou integrações externas.

### Validação final da fase 6

Evidência de **2026-10-07**: instalação congelada, lint, typecheck, test, test:integration, build e test:e2e passaram. **334 testes**: 202 unitários (65 frontend/DOM incluídos), 10 HTTP, 96 integrações reais PostgreSQL/Redis e 26 jornadas E2E Chromium. Os 270 cenários anteriores foram preservados. Sete migrations aplicadas desde zero e seed repetido nos bancos isolados; atualização incremental do banco local e seed duas vezes sem reset ou dados comerciais fictícios. Corridas de conversão/movimentação entre atores diferentes, FKs e scopes tenant/filial/carteira, rollback, decimal, configuração de etapas e histórico atômico passaram.

pnpm dev iniciou web/API/worker; health/live/ready, Swagger/OpenAPI, login/contexto/logout, seis páginas/listas autenticadas e job técnico pelo worker foram conferidos. Navegador em desenvolvimento sem erros de aplicação/hydration; jornadas E2E com axe e 375/768/1024/1440/1920px. Logs e 32 artefatos JavaScript públicos conferidos sem secrets locais; .env 0600/ignorado. CI mantém seus checks e executa as suites ampliadas; execução remota não foi verificada nesta sessão. Sem alteração de dependências ou configuração de ambiente. Nenhuma dívida técnica consciente introduzida nesta etapa. Não foram utilizados remendos ou workarounds. A fase 6 está concluída; a fase 7 exige nova solicitação.

## Tarefas, follow-ups, timeline e notificações — fase 7

Atualizar banco local: `pnpm db:migrate` e `pnpm db:seed`, preservando volumes. A migration `20261007200000_create_tasks_activities_reminders` eleva o histórico a oito migrations. Seed atualiza somente demo e catálogo (44 permissões), sem tarefas/interações/notificações fictícias. Não há novos serviços nem secrets: **worker agora exige DATABASE_URL**, além de Redis, para ler checkpoints e entregar notificações. Execute os três processos com `pnpm dev`; fila notifications é consumida pelo worker separado.

Web: `/tasks` possui lista filtrada/paginada, criação e detalhes `/tasks/:id`. Clientes, leads e oportunidades têm Timeline, Registrar interação e Novo follow-up. Tarefas podem não possuir alvo; interações exigem um Contact/Lead/Opportunity. Concluir, reabrir, editar e arquivar usam versão. Vencimento e lembrete são apresentados no fuso do navegador; Hoje usa o dia local, incluindo mudanças de horário de verão. Lembrete exige vencimento e ocorre até ele. Não há recorrência, calendário externo ou lembretes WhatsApp.

Endpoints abaixo usam bearer e contexto selecionado, com DTOs estritos, scopes por ação e Swagger real:

| Método               | Rota em `/api/v1`                                        | Comportamento                                             |
| -------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| POST / GET           | `/tasks`                                                 | criar / listar tarefas autorizadas                        |
| GET                  | `/tasks/assignment-branches`, `/tasks/assignment-owners` | destinos autorizados e paginados por ação                 |
| GET / PATCH / DELETE | `/tasks/:id`                                             | consultar / alterar / arquivar com expectedVersion        |
| POST                 | `/tasks/:id/complete`, `/tasks/:id/reopen`               | concluir / reabrir com expectedVersion                    |
| GET                  | `/tasks/:id/history`                                     | histórico mínimo paginado                                 |
| GET                  | `/tasks/:id/reminder`                                    | último checkpoint e código seguro, sem payload de job     |
| POST                 | `/tasks/:id/reminder-retry`                              | reapresentar falha definitiva, autorizado e versionado    |
| POST                 | `/activities`                                            | registrar interação manual com alvo explícito             |
| GET                  | `/activities/:type/:id/timeline`                         | type contact/lead/opportunity; agregar fontes autorizadas |
| GET                  | `/notifications`                                         | caixa privada da membership selecionada                   |
| POST                 | `/notifications/:id/read`                                | marcar aviso próprio como lido, idempotentemente          |

Filtros Task: busca por título/descrição, active/status/kind/priority, filial/responsável, intervalo UTC from/until, alvo type+ID e due overdue/today/upcoming. Today direto na API é UTC; web envia intervalo local convertido. Paginação keyset tem limite máximo 100. Tarefa vinculada exige leitura atual do alvo; a ligação nunca amplia escopo. Notification continua privada mesmo para ADMIN/ORGANIZATION e também revalida visibilidade da tarefa/alvo.

### Operação de lembretes

Request grava tarefa/histórico/TaskReminder em uma transação PostgreSQL, sem Redis na request. Worker reconcilia lotes de 25 a cada 15s e usa leases de 60s, BullMQ notifications com concorrência 4, cinco tentativas e backoff exponencial com jitter limitado a 60s. Deduplicação e checkpoint final estão no PostgreSQL. Notificação + COMPLETED são atômicos. Perda de jobs/Redis ou crash do dispatcher é recuperada por lease/reconciliação; réplica concorrente usa SKIP LOCKED. O fuso é de apresentação, agendamento usa UTC.

Atraso é possível durante indisponibilidade. Logs estruturados mostram pending/failed/lagMs e jobId; status por tarefa exibe PENDING/DISPATCHED/COMPLETED/CANCELED/FAILED. Após corrigir infraestrutura, FAILED pode ser reapresentado pelo detalhe da tarefa ou endpoint reminder-retry, sem nova identidade nem adiantamento do horário. Job com contrato inválido falha permanentemente; banco preserva intenções válidas. Failed set BullMQ retém até 1000 jobs e conclusão até 100; não remover checkpoints PostgreSQL para limpar fila. Não há ferramenta externa de alerta ou promessa de SLA nesta etapa. Shutdown drena consumidores antes de desconectar Prisma.

Validação: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm test:e2e`. Integração/E2E usam PostgreSQL/Redis/worker reais descartáveis. Uma constraint temporária **somente no banco isolado de teste** provoca falhas reais de entrega para comprovar rollback, cinco retries e replay; é removida no finally. Nenhuma alteração operacional de produção é feita por testes. ADR-016 descreve decisões e limites; a fase 8 permanece fora do escopo.

Evidência final de **2026-10-07**: instalação congelada, lint, typecheck, test, test:integration, build e test:e2e passaram. **383 testes**: 223 unitários (75 frontend/DOM incluídos), 10 HTTP, 118 integrações reais e 32 E2E. Todos os 334 cenários anteriores foram mantidos. Oito migrations aplicadas desde zero, seed idempotente, isolamento/scopes/IDOR, concorrência/histórico, UTC/DST e precisão de datas, recuperação Redis/lease, cinco falhas com rollback e replay foram verificados. Browser real passou jornada e cinco larguras com axe/foco. Atualização do banco local e seed duas vezes preservaram IDs/timestamps/credenciais/dados sem tarefas/interações/notificações fictícias. pnpm dev confirmou três processos, health/live/ready, Swagger, APIs autenticadas, job técnico e tarefas/formulário/notificações em 375/1440px sem erros de aplicação/hydration. Shutdown drenou o consumidor antes de encerrar Prisma. Foram conferidos 103 artefatos JavaScript públicos e 21 logs sem secrets do servidor; .env permanece 0600/ignorado e fixtures E2E foram removidas. CI existente executa as suites ampliadas; sua execução remota não foi verificada nesta sessão. Nenhuma funcionalidade da fase 8 foi iniciada.

## Produtos e tabelas de preços — fase 9

Atualize o banco local preservando volumes: `pnpm db:migrate` e `pnpm db:seed`. São nove migrations; a nova é `20261008140000_create_products_price_lists`. Seed atualiza quatro permissões de catálogo na demo, sem produtos/preços fictícios. Nenhum novo secret, serviço ou dependência. Tenants anteriores fora da demo exigem concessão administrativa explícita, não SQL global de privilégio.

Acesse Produtos no menu ou `/products`; tabelas ficam em `/products/price-lists`. Cadastre produto com nome, SKU e unidade; a unidade é fixa após a criação para preservar a interpretação dos preços. SKU normaliza uppercase e é único por organização inclusive arquivados. Abra uma tabela organizacional ou de filial, defina moeda BRL/USD/EUR/GBP e adicione produtos/preços. Filial e moeda são fixas; para mudá-las crie outra tabela. Preço usa ponto decimal, no máximo 12 inteiros/seis casas decimais, transportado como string. Não existem estoque, câmbio, importação, ERP ou orçamento nesta etapa.

Endpoints, todos Bearer+TenantContext e documentados em `/docs`:

| Método               | Rota (prefixo `/api/v1`)            | Uso                                                   |
| -------------------- | ----------------------------------- | ----------------------------------------------------- |
| GET / POST           | `/products`                         | Lista paginada / criação                              |
| GET / PATCH / DELETE | `/products/:id`                     | Detalhe / edição / arquivamento                       |
| GET / POST           | `/price-lists`                      | Lista autorizada/paginada / criação                   |
| GET                  | `/price-lists/available-branches`   | Filiais autorizadas e organizationAllowed para gestão |
| GET / PATCH / DELETE | `/price-lists/:id`                  | Detalhe / renomear / arquivar                         |
| GET                  | `/price-lists/:id/items`            | Preços paginados; products.read adicional             |
| PUT / DELETE         | `/price-lists/:id/items/:productId` | Definir/reativar preço / arquivar preço               |

POST cria com 201; outras mutações retornam 200. DELETE arquiva, nunca apaga. PATCH/DELETE/PUT exigem expectedVersion; em itens é a versão da **lista**, incrementada a cada alteração. Após 409, recarregue antes de reenviar; o formulário conserva o input para revisão. GETs de produtos/listas usam search/active/limit/cursor/sort/direction; listas também branchId, incluindo lista compartilhada. Itens usam active/limit/cursor (UUID). Default 25, máximo 100, sem count ou itens ilimitados no detalhe.

products.read compartilha catálogo; products.manage exige ORGANIZATION. price-lists.read permite catálogo compartilhado e filiais do mesmo grant; OWN lê suas filiais. price-lists.manage para tabela compartilhada exige ORGANIZATION; para filial exige grant que cubra a filial. ADMIN/DIRECTOR gerenciam catálogo; SALES_MANAGER gerencia preços conforme seu scope; outros templates leem. O papel é dado, não bypass. canManage/organizationAllowed são hints de UX; backend revalida toda escrita.

Validações: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build` e `pnpm test:e2e`. Integração usa PostgreSQL/Redis/API/worker reais descartáveis e migrations desde banco vazio; E2E usa Chromium real com axe, jornada do catálogo e troca de organização. Não depende da Evolution local ou da VPS.

Evidência final de **2026-10-08**: instalação congelada, lint, typecheck, test, test:integration, build e test:e2e PASS. **434 testes**: 250 unitários (79 frontend/DOM incluídos), 10 HTTP, 138 integrações reais e 36 E2E. Nove migrations em banco limpo e seed duas vezes; banco local recebeu somente a migration incremental e seed preservou IDs/credenciais. Uniques/versionamento com atores distintos, constraints entre tenants, grants por ação/filial, precisão decimal, arquivamento/reativação e unidade/moeda/filial fixas foram cobertos. Jornada real e três larguras do catálogo passaram com axe/foco, preservando todos os cenários anteriores. Web/API/worker em desenvolvimento, health/Swagger, leituras autenticadas e job técnico passaram; artefatos públicos/logs sem secrets. CI existente cobre as suites; execução remota não foi verificada nesta sessão. Fase 9 concluída; integração CRM da fase 8 adiada e fase 10 aguardando solicitação.
