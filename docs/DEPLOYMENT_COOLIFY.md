# Publicação no Coolify

Pacote para Coolify com **proxy Traefik** e modo **Raw (deploy file as-is)**. Consulte ADR-019. Esta documentação não executa deploy ou migração da VPS. Cinco serviços contínuos: web/API/worker/PostgreSQL/Redis. Migrate é one-shot; initial-setup é um comando manual opt-in. Evolution não é necessária.

## 1. Requisitos

- VPS com Coolify e Docker Compose v2, proxy Traefik ativo, portas públicas 80/443 e DNS do CRM apontando para o servidor. Firewall não deve publicar 3000/3001/5432/6379.
- Repositório GitHub acessível pelo Coolify, branch main. Build usa Node 24.19.0/pnpm 11.19.0 fixados; nenhuma instalação Node manual na VPS é necessária.
- Para a primeira construção, recomenda-se VPS/build server com 4 vCPU, 8 GiB RAM e espaço para imagens/volumes/backups. Ajustar por medição; isso não é dimensionamento de carga validado.
- PostgreSQL/Redis novos e volumes exclusivos desta instalação. Para migrar um banco existente, fazer backup/restore próprio e não executar initial-setup.

O pacote depende dos entrypoints Traefik `http`/`https` e certresolver `letsencrypt` usados pelo Coolify. Verifique o proxy existente; não desative TLS ou troque certificados para contornar erro. Instalações com Caddy precisam de configuração de publicação própria.

## 2. Rede e IP do proxy

No terminal administrativo da VPS, identifique o container proxy (normalmente coolify-proxy) e sua rede:

```bash
docker network ls
docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}'
```

Use a rede correta em COOLIFY_PROXY_NETWORK, normalmente coolify. TRUST_PROXY_CIDRS recebe **somente o IP do proxy nessa rede**, com /32 para IPv4 ou /128 para IPv6. Não usar true, wildcard, /0, número de hops ou subnets genéricas. Após recriar proxy/rede, confira o IP e rede e atualize o resource antes de validar login. Traefik forwardedHeaders.insecure deve permanecer false; eventual CDN/load balancer exige revisão de sua cadeia de confiança, não adicionar IP vindo de um header.

## 3. Criar o resource

1. No projeto/ambiente do Coolify, crie uma aplicação a partir do GitHub: diogo-91/crm_projeto_novo, branch main.
2. Selecione o build de Docker Compose, Base Directory `/`, Compose Location `/docker-compose.production.yml` (ou caminho relativo conforme a versão do painel).
3. Habilite **Raw / deploy file as-is**. O arquivo já declara labels Traefik e rede externa; não use o modo que gera/modifica labels de publicação.
4. Não cadastrar domínios automáticos concorrentes para web/API. CRM_HOST e os labels do arquivo controlam o domínio. Não ativar profile operations no deploy regular.
5. Configure **Docker Compose Custom Start Command** exatamente como abaixo (o Coolify injeta os caminhos do Compose e do env em cada chamada):

   ```sh
   docker compose up -d --wait postgres redis && docker compose run --build --rm migrate && docker compose up -d --wait web api worker
   ```

   Essa sequência é obrigatória: migrations falham antes de iniciar a nova aplicação, o job é removido e não participa do health global. O profile operations não deve ser ativado globalmente. `--build` garante que o migrator desse profile use a release atual, mesmo quando sua imagem já existe; o build regular não inclui serviços de profiles inativos.

6. Build arguments devem ser gerenciados pelo Dockerfile. NEXT_PUBLIC_API_URL está explicitamente declarado em build.args. Não injetar DATABASE_URL/JWT/senhas como build args, nem adicionar `.env` ao Git.
7. Confira volumes persistentes postgres_data/redis_data e um nome de projeto/resource que não seja alterado em redeploy. API/worker devem ser sempre publicados da mesma release.

Referência: https://coolify.io/docs/applications/builds/docker-compose . Os nomes do painel variam por versão; manter o comportamento Raw e não a geração automática de rotas.

## 4. Variáveis

Use `deploy/production.env.example` como catálogo, sem enviar secrets pelo chat. Cadastre os valores no painel seguro do resource:

| Variável                    | Valor / escopo                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------ |
| CRM_DEPLOYMENT_NAME         | nome exclusivo, por exemplo crm-comercial; letras minúsculas/números/hífen           |
| CRM_HOST                    | crm.seudominio.com, sem esquema, porta ou path                                       |
| COOLIFY_PROXY_NETWORK       | rede existente do Traefik                                                            |
| TRUST_PROXY_CIDRS           | IP exato do proxy /32 ou /128                                                        |
| NEXT_PUBLIC_API_URL         | https://crm.seudominio.com/api/v1; disponível no build                               |
| CORS_ORIGINS                | https://crm.seudominio.com, sem slash final                                          |
| POSTGRES_DB / POSTGRES_USER | crm ou nomes privados escolhidos                                                     |
| POSTGRES_PASSWORD           | senha longa aleatória, preferencialmente hexadecimal                                 |
| DATABASE_URL                | postgresql://USUARIO:SENHA@postgres:5432/BANCO; usar os mesmos valores de PostgreSQL |
| REDIS_PASSWORD              | segredo aleatório privado                                                            |
| JWT_SECRET                  | 32 bytes aleatórios, base64url canônica sem padding; 43 caracteres                   |
| LOG_LEVEL                   | info, salvo diagnóstico controlado                                                   |

NODE_ENV=production, API_HOST=0.0.0.0 e portas internas já são definidos no Compose. Não alterar para development. Web não recebe secrets de banco/Redis/JWT. INITIAL_* ficam vazias no deploy regular; não há senha de administrador padrão.

Gere secrets com um gerador seguro local; guarde os valores no gerenciador de segredos/painel. Se a senha PostgreSQL tiver símbolos, fazer percent-encoding **somente na URL**. Após o primeiro boot, mudar POSTGRES_PASSWORD não altera automaticamente a senha do banco existente: execute a rotação planejada com atualização coerente de API/worker/migrator.

## 5. Deploy e migrations

Clique Deploy. O Dockerfile instala lockfile congelado, gera Prisma e constrói apps/packages. O Custom Start sobe PostgreSQL/Redis saudáveis, executa migrate em container one-shot removido ao concluir e só então inicia API/worker/web. Migrate aplica as dez migrations existentes e precisa encerrar com código zero; web aguarda readiness da API. Em falha de migration, corrigir a causa com backup e plano de recuperação; não usar db push, reset ou ignorar erro.

Migrate e initial-setup pertencem ao profile operations e são executados somente por run --rm. O deploy regular deixa cinco serviços contínuos; não depende de labels não padronizados de exclusão de health nem deixa jobs exited registrados como serviços saudáveis. Não usar docker compose up isoladamente na primeira instalação ou release: ele não executa as migrations deste profile.

Rotas do domínio:

- `/`, `/login` e páginas CRM → web:3000.
- `/api/v1` e `/api/v1/*` → api:3001, preservando todo o path.
- `/health`, `/health/live`, `/health/ready` → API.
- HTTP → HTTPS. Cookie refresh __Host-crm-refresh, Secure/HttpOnly/Lax.

Swagger não é exposto pela rota pública. Para conferir no terminal do container API:

```bash
node -e "fetch('http://127.0.0.1:3001/docs/openapi.json').then(async r=>{console.log(r.status);if(!r.ok)process.exitCode=1})"
```

Não publicar PostgreSQL/Redis ou o socket Docker para o CRM. API/worker/web executam como UID 1000. Worker não tem HTTP nem healthcheck fictício: monitorar estado/restarts/logs e confirmar processamento com queue probe.

## 6. Primeiro administrador — somente banco vazio

Abra um **terminal interativo privado** do serviço API, após migrations/readiness. O container contém o comando compilado. Configure os nomes reais e e-mail do administrador; não escrever a senha na linha do comando. Execute:

```sh
export INITIAL_SETUP_CONFIRM=CREATE_FIRST_ORGANIZATION
export INITIAL_ORGANIZATION_NAME='Sua Empresa'
export INITIAL_BRANCH_NAME='Matriz'
export INITIAL_BRANCH_CODE=MATRIZ
export INITIAL_ADMIN_NAME='Administrador'
export INITIAL_ADMIN_EMAIL='seu-email@empresa.com'
printf 'Digite a senha inicial (12-128 caracteres): '
trap 'stty echo' EXIT INT TERM
stty -echo
IFS= read -r INITIAL_ADMIN_PASSWORD
stty echo
printf '\n'
export INITIAL_ADMIN_PASSWORD
node apps/api/dist/bootstrap/initial-setup.js
unset INITIAL_ADMIN_PASSWORD INITIAL_SETUP_CONFIRM
exit
```

Use terminal com TTY e echo desligado; não execute esse bloco em logs de deploy, chat ou executor não interativo. Verifique **initial organization provisioned** e código zero. O comando cria uma organização, uma filial, identidade global com Argon2id, membership/vínculo principal, seis templates tenant e ADMIN ORGANIZATION. Não concede PlatformGrant nem popula clientes/produtos/orçamentos demo.

O banco deve estar sem Organization **e** User. Advisory lock e transação garantem uma única inicialização. Repetição falha sem mudar credenciais/grants; não é recuperação de senha. Se dados já existem, manter o acesso/provisionamento administrativo autorizado existente. Não executar seed demo com NODE_ENV adulterado.

Alternativa para operadores Docker Compose fora do painel: com o **mesmo projeto, volumes, checkout/release e env privado** usados pela instalação, preencher INITIAL_* e executar `docker compose --env-file /caminho/privado/production.env -f docker-compose.production.yml --profile operations run --build --rm initial-setup`. Remover senha/confirmação depois. Não clonar em um novo projeto para executar esse comando contra volumes diferentes.

## 7. Conferência depois do deploy

- Abra https://crm.seudominio.com/login, faça login e confirme organização/filial; teste reload para verificar refresh. Não existe senha padrão.
- GET /health/live e /health/ready retornam 200; perda de PostgreSQL/Redis deve resultar em readiness 503.
- GET /api/v1/quotes sem bearer deve retornar 401.
- No terminal privado API, `node apps/api/dist/bootstrap/queue-probe.js` deve registrar queue probe completed; confirma API → Redis/BullMQ → worker.
- Confira logs estruturados sem senha/token, healthchecks, volumes e restart count. Não chamar queue probe a cada healthcheck.
- Se login retorna 403, confira Origin/CORS/domínio. Se retorna 429 indevido, confira proxy/IP; não aumentar limites para esconder configuração errada.
- Se web aponta para localhost ou outro domínio, corrigir NEXT_PUBLIC_API_URL **e reconstruir**; mudar somente runtime não muda bundle compilado.

## 8. Releases, backup e rollback

Antes de adicionar dados reais e de qualquer release, configurar backup PostgreSQL externo e criptografado, acesso mínimo, retenção e restore testado. Exportação administrativa possível:

```sh
pg_dump -Fc --no-owner -U USUARIO -d BANCO -f /caminho/privado/crm.dump
```

Executar com conexão/autenticação privadas corretas ou dentro do container e transferir o arquivo para armazenamento externo seguro. Um backup no próprio volume/VPS não cobre perda da VPS. Testar pg_restore em banco separado; definir RPO/RTO, monitoramento/alertas e política LGPD com responsáveis. Redis AOF/noeviction preserva filas; reconciliador PostgreSQL de lembretes continua obrigatório. Uma VPS/banco/Redis não fornecem HA.

Atualizações usam migrate deploy em uma nova execução run --rm antes da nova API/worker. O Custom Start realiza essa sequência em cada release, sem reutilizar container exited antigo. Para operação Docker manual, execute as mesmas três chamadas com o mesmo -f, --env-file e --project-name. Confira logs/código de saída do migrate em cada release.

Rollback de imagem precisa ser compatível com o schema já migrado. Não reverter SQL automaticamente, apagar migrations ou usar down -v. Para falhas de migration, analisar o estado e recuperar conforme backup/migration revisada, nunca marcar sucesso artificialmente.

## 9. Validação local do pacote

`pnpm test:deploy` exige Docker, openssl e acesso aos registries na primeira construção. Cria recursos crm-deploy-* próprios e remove apenas os seus. Constrói os targets reais, aplica migrations em banco limpo, provisiona administrador, valida repetição, HTTPS com CA verificada, cookies/refresh, Origin, forwarded headers forjados, fila, UID/dependências, restart e shutdown. Não usa volumes/credenciais do desenvolvimento ou da VPS.

Este pacote não instala nada na VPS por si só. DNS/certificado ACME, versão/configuração do Coolify, backups externos e operação real precisam ser conferidos no destino. Preparar deploy não significa encerrar toda a fase 14 ou iniciar a fase 11.
