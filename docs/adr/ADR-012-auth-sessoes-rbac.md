# ADR-012 — Autenticação, sessões, escopos e bootstrap seguro

Status: implementado e validado na fase 3. Data: 2026-10-06.

## Context

A fase 3 encerra a exceção local sem autenticação do ADR-011. Identidade global, sessões revogáveis e grants tenant precisam coexistir sem elevar permissões ao trocar organizationId. ADR-006 define UserRole e BRANCH_SET; ADR-008 define refresh opaco em cookie e reuso com revogação. Criar organização é uma operação de plataforma, diferente de administrar um tenant. A solicitação atual exclui envio de e-mail/recuperação funcional e frontend completo.

## Decision

PasswordHash nullable em User permite migrar identidades existentes e criar usuários estruturais sem credencial: esses usuários não podem fazer login. Não criar convite/reset parcial. Argon2id, 64 MiB, três iterações, paralelismo 1 e salt aleatório; senha nova de 12–128 caracteres, sem truncamento ou transformação. Login normaliza pelo mesmo emailSchema do cadastro e verifica um hash neutro quando identidade/credencial não existem, retornando erro genérico. argon2 0.45.1 suporta Node 24 via Node-API; jose 6.2.12 é ESM/WebCrypto, sem adaptador Nest com peers incompatíveis. Releases verificadas, estáveis e fora da janela mínima de maturação.

JWT HS256 com chave aleatória de 256 bits, base64url canônica, obrigatória no ambiente; sem fallback, algoritmo alternativo, chave fornecida pelo token ou consulta remota. Issuer/audience explícitos. Access de 15 minutos, somente sub/sid/cv e claims temporais/issuer/audience. Session tem validade absoluta de 30 dias e contexto selecionado, não extensível por refresh. Cada login cria sessão independente. Um membership ativo é escolhido automaticamente somente se for o único; zero ou vários exigem contexto nulo e seleção explícita. POST auth/context verifica pertencimento e incrementa contextVersion; tokens antigos dessa sessão deixam de funcionar. Não escolher a primeira organização arbitrariamente.

Sessão/User são verificados no PostgreSQL em todo request autenticado, sem cache de sessão/RBAC ou blacklist Redis. User.securityVersion protege corridas de senha/logout-all versus login e refresh; Session guarda a versão usada. Troca de senha exige senha atual, troca hash atomicamente e revoga todas as sessões; logout-all também incrementa a versão. Logout revoga a sessão atual imediatamente, inclusive access token. Requests já autorizados podem terminar; novas autorizações exigem estado atual. Nenhum acesso é concedido quando o banco falha.

Refresh aleatório de 32 bytes, só SHA-256 no banco; Session agrupa a família e RefreshToken guarda predecessor e usedAt. A atualização legítima de lastUsedAt adquire o lock de Session antes de reler/consumir o token, serializando rotação, logout e contexto. Token consumido reutilizado revoga toda a sessão em transação que precisa COMMITAR antes de devolver 401. Uma corrida de refresh tem um consumo e um reuso: família revogada, sem janela tolerante. Contexto inativo não ganha fallback para outra organização. Cliente futuro precisa single-flight e pode ter de autenticar novamente após perda de resposta.

Refresh só em cookie HttpOnly, SameSite=Lax, Secure e prefixo __Host- em produção, Path=/ e sem Domain. Cookie local sem Secure somente em development/test. Login/refresh/logout exigem Origin da allowlist e JSON; Bearer é a única credencial nos demais endpoints. CSRF usa verificação estrita de Origin e content-type não simples, com CORS explícito/credentials=true, sem wildcard; rejeitar Origin ausente/null/externa nos endpoints de cookie. Auth não é cacheável; não devolver refresh no body e não persistir access no frontend. Sem trust proxy implícito: IP do socket, nunca X-Forwarded-For arbitrário.

RBAC conserva Role por organização, Permission global, RolePermission e UserRole + UserRoleBranch. Escopos canônicos OWN/BRANCH/BRANCH_SET/ORGANIZATION; BRANCH_SET representa MULTI_BRANCH. Cada grant combina suas próprias ações e escopo. OWN compara ownerMembershipId e limita filial aos vínculos ativos; grants de filial são explícitos e limitados a MembershipBranch. ORGANIZATION cobre somente as ações daquele grant no tenant selecionado. Listas filtram no banco antes de paginação, e projeções de memberships ocultam filiais fora do escopo da ação. Mutações organizacionais e gestão de grants exigem escopo ORGANIZATION; leitores restritos não ganham poder administrativo por associação à filial.

SUPER_ADMIN global não é necessário para gerenciar tenants e não será criado como bypass. Seis templates tenant (ADMIN, DIRECTOR, SALES_MANAGER, SELLER, AFTER_SALES, VIEWER) são persistidos, não checks de papel no código. ALL não é aceito em UserRole. Para preservar POST organizations com autorização real, existe PlatformGrant separado, limitado à permission de plataforma organizations.create, com usuário, motivo e expiração. Ele não autoriza ler dados de nenhum tenant ou trocar contexto sem membership. Permission distingue domínio ORGANIZATION/PLATFORM; FKs/checks impedem colocar permission de plataforma em RolePermission ou permission tenant em PlatformGrant. Bootstrap local dessa capacidade exige opt-in SEED_PLATFORM_PROVISIONING=true; padrão false e sem endpoint que conceda essa capacidade. Sem sistema geral de suporte global nesta etapa.

Criação autorizada de organização provisiona, atomicamente, membership do criador, templates e ADMIN ORGANIZATION nesse novo tenant. Usuários comuns criados pela API não recebem credenciais nem papel por padrão. Role assignment requer users.manage organizacional, não pode alterar a própria membership e não pode conceder ações/escopos que o concedente não possui em um grant completo. Role definitions/permission catalog não são editáveis por API. Actor/target memberships são bloqueadas em ordem estável e a autorização relida dentro da transação de concessão/remoção; Prisma não oferece FOR UPDATE, então esse lock específico usa SQL parametrizado, sem repositório SQL paralelo. FKs compostas protegem role/membership/branches; constraint triggers deferidos verificam cardinalidade BRANCH=1, BRANCH_SET>=1 e ausência de branches em OWN/ORGANIZATION.

Guards globais negam por padrão: health e login/refresh são públicos explicitamente; métodos de identidade usam sessão válida; todos os endpoints administrativos exigem permission e contexto. UUID de URL não escolhe nem troca tenant: mismatch retorna 404 sem revelar recurso. Testar IDOR, combinações de grants, ausência de metadata e todas as rotas existentes.

Rate limiting Redis atômico com TTL por IP e por hash e-mail/IP em login; refresh tem orçamento por IP. Limites configuráveis, sem bloqueio permanente de conta. Redis indisponível retorna 503 nesses endpoints, sem fallback local ou bypass; autorização de recursos continua PostgreSQL. Não registrar chaves que revelem e-mail, senhas, tokens, hashes ou cookies. Logs estruturados de eventos de segurança com IDs seguros; AuditLog completo permanece fora desta fase.

O seed passa a ser um bootstrap standalone em apps/api, consumindo os mesmos exports proprietários de users/organizations/access-control e PasswordService. packages/database preserva Prisma/migrations; Prisma db seed chama o bootstrap compilado e o comando da raiz prepara o build. Remover a implementação anterior do seed, sem duplicar hashing/provisionamento nem criar pacote genérico. Seed exige SEED_ADMIN_PASSWORD no ambiente, recusa produção, não altera senha/grants existentes em repetições e não imprime credenciais. Não criar senha hardcoded. Fixtures/ambiente local geram secrets aleatórios de forma privada.

## Alternatives Considered

- JWT longo ou sessão ignorada: viola revogação imediata do ADR-008.
- Refresh em body/localStorage: não segue a estratégia browser aprovada.
- Refresh sobrescrito sem histórico ou janela de reuso: perde detecção de roubo.
- Role direto no User ou unir permission de um grant ao scope de outro: viola identidade multiempresa e permite elevação.
- Renomear BRANCH_SET ou introduzir dois enums concorrentes: desnecessário; documentar equivalência MULTI_BRANCH.
- Transformar ADMIN tenant em SUPER_ADMIN global: viola a separação da plataforma.
- Bloquear permanentemente POST organizations ou deixá-lo aberto: mantém uma operação incompleta ou insegura; a capacidade explícita e limitada resolve o caso real.
- Cache/blacklist/permissões em JWT: aumenta invalidação sem evidência de necessidade.
- Seed no pacote database importando API: cria ciclo de workspace; bootstrap próprio com módulos reais mantém a dependência API→database.

## Consequences

Auth/RBAC são completos para o escopo autorizado, com dependência de PostgreSQL por request e Redis para limites de auth. Troca de contexto invalida tokens da sessão/dispositivo; outros dispositivos permanecem independentes. Refresh concorrente exige novo login. Credenciais de identidades estruturais precisam de provisionamento legítimo futuro; nenhum fluxo de e-mail/reset é simulado. PlatformGrant é estreito e expira, não suporte global. Lock e triggers são infraestrutura específica, documentada e testada em PostgreSQL real. API/seed compartilham os mesmos módulos sem senha padrão, auth bypass ou duas implementações da mesma responsabilidade.

A revisão reforçou revalidação da sessão nas transações de escrita e cardinalidade de grants no UPDATE de filiais. A correção SQL é uma migration incremental separada, preservando a primeira migration de auth já executada nos testes. AccessControl usa projeções somente de leitura de sessão/User/membership para segurança; não escreve em entidades de outros módulos.
