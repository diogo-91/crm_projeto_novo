# ADR-010 — Fundação técnica, versões e execução local

Status: implementado na fase 1. Data: 2026-10-06.

## Context

A fase 0 definiu stack/limites sem código. A fundação precisa comprovar instalação, strict types, HTTP, persistência, fila e worker separados sem antecipar domínio. Tags latest nem sempre representam versões estáveis compatíveis: Prisma CLI apontava para 8 RC e TypeScript 7 estava fora dos peers de Swagger/typescript-eslint. O preset Next completo trazia plugins React/import/a11y com peers apenas até ESLint 9; essa linha já estava marcada como descontinuada.

## Decision

Fixar Node 24.19 LTS, pnpm 11.19, Next 16.3.8/React 19.3, Nest 12.1.2/Swagger 12.0.2, TypeScript 6.0.3, Prisma/client/adapter-pg 7.10.0, ESLint 10.12, typescript-eslint 8.71.0, Vitest 5.0.3/Vite 8.3.2 e SWC 1.16.13. Usar releases estáveis dentro das faixas de peers publicadas; lockfile e peers estritos. Sem force, overrides de peers ou legacy-peer-deps. typescript-eslint 8.71.0 é a release compatível já fora da janela mínima de maturação de 24 horas; 8.71.1 ainda estava dentro da janela. Não relaxar a política para instalá-la.

ESLint flat config compõe APIs oficiais de @eslint/js, typescript-eslint, @next/eslint-plugin-next/core-web-vitals e eslint-plugin-react-hooks 7.1.1 (suporta ESLint 10), em vez de carregar plugins legados incompatíveis com o código/stack modernos. Regras tipadas de promises/unsafe/any e restrições entre pacotes são erros. Não rebaixar falhas a warning ou desligar regras para corrigir código.

pnpm 11 tem política em pnpm-workspace.yaml, incluindo peers estritos e allowBuilds explícito para pacotes nativos/Prisma; bloquear script de telemetria @scarf/scarf. Não usar configuração antiga de npmrc como se fosse aplicada. No container de desenvolvimento em nuvem cujo PID 1 não recolhe órfãos, o startup é supervisionado pelo Tini/docker-init já incluído no Docker, com -s (subreaper). Isso corrige supervisão/reaping no runtime sem wrapper próprio, alteração de scripts do produto ou mudança nos processos API/worker. Startup e encerramento com um único Ctrl+C foram testados. Caches em sandbox seguem XDG sob /tmp quando diretório pessoal não é gravável; verificar permissões confiáveis, sem desabilitar validação de cache, TLS ou integridade.

Código runtime usa ESM (`type: module`) e resolução/emissão NodeNext, com extensões .js explícitas no backend; o frontend usa resolução Bundler do Next e imports de fonte sem extensão e client Prisma ESM, conforme Nest 12 e Node 24. Não misturar CommonJS no backend moderno nem criar bridges de require. Aplicações rodam por pnpm em desenvolvimento; PostgreSQL 18.6 e Redis 8.10.2 oficiais em Compose com digest, volumes e healthchecks, portas loopback e senhas locais aleatórias. API/worker compilam com tsc e metadata Nest; Vitest usa a API oficial de transformação do SWC com os mesmos decorators/metadata, em um único plugin Vite pequeno. Não depende de adaptadores multi-bundler cujos tipos exigem bundlers que este projeto não usa. Shutdown usa a opção oficial Nest `useProcessExit: true` após hooks, garantindo o evento exit para flush dos logs Pino; integração aguarda close dos streams e exige código 0. Worker usa Nest Application Context e exports runtime da API; BullMQ gerencia suas conexões com opções centralizadas, sem cliente Redis de requests desnecessário no processo worker; nenhum listener HTTP ou módulo comercial.

packages/config tem entradas públicas/servidor separadas e validação Zod por papel. database gera client próprio com Prisma 7/adapter-pg e ciclo de vida Nest, sem instâncias dispersas. Uma tabela InfrastructureMetadata valida migration/seed idempotente sem domínio; não materializar o ERD. Foundation-probe é a única fila, apenas diagnóstico, validada producer→worker em teste real. Não é transporte durável para efeitos comerciais.

Health usa PostgreSQL/Redis reais com timeouts finitos, 503 em falha e liveness independente. requestId novo por request, correlationId externo limitado. Logger JSON único por processo via DI, sem payloads/secrets. Swagger técnico mapeia a apresentação OpenAPI com chaves verificadas por mapped types do contrato e enums provenientes do Zod; não mantém tipos/valores independentes nem força casts de JSON Schema incompatível. O contrato publicado é testado. Vitest e integração em Compose isolado comprovam migrations/repetição/seed/queue/shutdown/degradação.

Next habilita a opção oficial experimental `strictRouteTypes`: verifica props/retornos de páginas e importa todos os tipos de rotas ativos via `next-env.d.ts`. O tsconfig inclui esse arquivo gerado, sem carregar simultaneamente declarações de dois builds (`.next/types` e `.next/dev/types`), que causam identificadores duplicados no tsc externo. Todos os tipos ativos e validadores continuam verificados, sem skipLibCheck ou supressão. O cache de build inclui next-env.d.ts junto aos tipos gerados; typecheck não é cacheado, pois typegen deve reconstruir/validar o conjunto ativo após alternar dev/build. A opção experimental deve ser reavaliada em upgrades do Next; validar alternância dev/build/typegen. `agentRules: false` preserva o AGENTS central; agentes consultam os guias instalados da versão Next.

## Alternatives Considered

- Última tag de todas as ferramentas: admite Prisma RC/TypeScript incompatível.
- ESLint 9 com preset Next integral: peers satisfazem, mas linha descontinuada não é fundação desejável; usar plugins oficiais compatíveis com ESLint 10 é decisão de composição explícita.
- tsx/esbuild sem metadata para Nest: exige mudar injeção ou divergir do compiler; tsc/SWC preservam o contrato de decorators.
- Containerizar todos os apps já: reduz dependência de Node local, mas adiciona complexidade de watch/build/pnpm para pouca utilidade inicial.
- Schema vazio: não comprova trajetória migration/seed de forma útil; uma tabela técnica é pequena e não antecipa negócio.
- Mocks para todo readiness/fila: não comprova PostgreSQL, Redis, protocolos, process boundaries ou shutdown.

## Consequences

Fundação tem matriz fixada e verificável, módulos públicos reutilizados e ambiente local simples. É preciso atualizar versões em conjunto pelos peers/testes, e não seguir latest isoladamente. Existem apenas infraestrutura e página técnica. Schema comercial/RBAC/outbox/integrações continuam fora do escopo.

Digest e credenciais locais não tornam Compose produção/HA. A fila diagnóstica não garante mensagens comerciais. Config e logger não devem virar depósito de domínio; worker não importa controllers/bootstrap HTTP. Documento de operação exato está no README.
