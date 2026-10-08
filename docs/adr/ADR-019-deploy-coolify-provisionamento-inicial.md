# ADR-019 — Deploy Docker/Coolify e provisionamento inicial

Status: aceito. Data: 2026-10-08. Escopo: pacote de deploy autorizado, sem publicação na VPS nesta tarefa.

## Context

O Compose existente é de desenvolvimento. API/web escutam loopback, autenticação exige cookies seguros em produção e o seed demo recusa produção. A entrega deve preservar monorepo, módulos, isolamento e a mesma origem HTTPS, sem conceder um bypass para inicializar o primeiro tenant.

## Decision

Um Dockerfile multi-stage usa Node 24.19.0 bookworm-slim por digest e pnpm 11.19.0. Instalação congelada, build topológico e Next standalone com tracing da raiz. O build copia static/public para o artefato conforme a documentação oficial Next; start local usa o mesmo servidor standalone em loopback, sem next start incompatível com esse output. CA corporativa opcional usa somente secret BuildKit build_ca durante instalação/build, mantendo TLS verificado; nunca copiar certificados do ambiente para a imagem. API/worker compartilham stage backend e artefatos da mesma release. Runtime usa usuário node, dependências de produção e init para sinais/reaping. Operations conserva ferramentas de build/Prisma propositalmente para migrations. Não existe compilação/watch/migration automática em cada processo de aplicação. Jobs removidos não participam do health global, sem depender de campos customizados incompatíveis com Compose Raw.

Dependências de produção do workspace são instaladas juntas no stage backend para preservar links pnpm e exports do worker→API sem alterar a resolução do monorepo ou ativar deploy experimental/injection. Isso inclui dependências web não consumidas pelo backend, custo conhecido de tamanho; não instala devDependencies declaradas da raiz/apps. As dependências dos pacotes de configuração do workspace também permanecem neste grafo, embora não sejam consumidas pela aplicação. Web standalone inclui somente arquivos rastreados. Redução adicional da imagem backend exige medição e um incremento de packaging próprio, não scripts que apaguem dependências manualmente.

Initial-setup reutiliza a imagem API: seu bootstrap já está compilado nela e não precisa do CLI Prisma ou das ferramentas de build. Somente migrate usa operations. A suite executa o provisionamento concorrente dentro da API, conforme o fluxo principal documentado, e verifica a rejeição da repetição também pelo profile initial-setup. Credenciais sintéticas são passadas pela entrada padrão do processo, sem argv ou logs.

`docker-compose.production.yml` possui web, API, worker, PostgreSQL e Redis, mais migrate one-shot e initial-setup opt-in por profile operations. Custom Start suportado pelo Coolify sobe infraestrutura saudável, executa migrate por run --build --rm e somente em sucesso inicia API/worker/web; PostgreSQL/Redis têm healthchecks e volumes separados do desenvolvimento. --build impede reutilizar migrator antigo, pois o build regular não inclui profiles inativos. Não expor portas do host; banco/Redis/worker ficam em rede backend internal. Somente web/API conectam à rede externa do proxy Coolify.

Coolify é configurado para **Raw (deploy file as-is)**, proxy Traefik, rede externa existente e labels explícitos com nome exclusivo da instalação. HTTPS host único, API `/api/v1` preservado com maior prioridade, health na API; restante na web. HTTP redireciona para HTTPS; certificado Let's Encrypt pelo proxy existente. `/docs` não é roteado publicamente; continua disponível internamente. Não acrescentar Nginx/Traefik como serviço do produto, nem publicar bancos pelo host. Não configurar domínios automáticos concorrentes ou remover prefixo da API.

API_HOST é IP validado, padrão loopback local, 0.0.0.0 no container. TRUST_PROXY_CIDRS usa IPs/CIDRs explícitos, sem boolean, wildcard ou /0; padrão vazio não confia em headers. Na publicação usar IP exato do proxy, /32 ou /128; verificar novamente após recriação do proxy. Express aplica cadeia de confiança padrão e Traefik não deve confiar em forwarded headers arbitrários da internet. Não definir trust proxy=true ou contagem de hops. NEXT_PUBLIC_API_URL é argumento público do build e deve corresponder ao domínio HTTPS publicado; secrets não são argumentos/contexto de build. `.dockerignore` exclui todos os ambientes, artefatos e configurações locais.

Bootstrap de produção é comando standalone, jamais endpoint nem startup automático. Config Zod exige production, confirmação CREATE_FIRST_ORGANIZATION, nomes, e-mail e senha fornecidos pelo operador. Advisory lock transacional serializa inicializações; banco não pode conter Organization nem User. Users cria identidade e hash via PasswordService; Organizations cria organização, uma filial e membership/vínculo principal; AccessControl provisiona os templates existentes e ADMIN ORGANIZATION. Tudo na mesma transação, sem PlatformGrant, senha padrão, dados demo ou associação por e-mail. Erro não deixa acesso parcial; repetição/conflito falha sem alterar identidades/credenciais. Usar o comando somente na primeira instalação; gestão posterior é pela API autorizada. O seed demo continua recusando production.

Provisionamento via terminal privado do container API lê senha do TTY com echo desligado e a passa somente ao processo; alternativa Compose usa profile operations/env privado. Não imprimir senha, incluí-la em argv/histórico ou mantê-la nas variáveis regulares da API/web. Remover variável e arquivo privado após uso. Operador precisa de acesso administrativo ao servidor; não é uma capacidade concedida a usuários CRM.

`pnpm test:deploy` é suite separada: cria projeto/rede/volumes próprios, constrói imagens reais, aplica migrations limpas, executa bootstrap, verifica repetição, HTTPS/rotas/cookies/refresh/Origin, rejeição anônima, forwarded headers forjados, queue probe, usuário non-root, dependências e restart/shutdown. Traefik e CA são exclusivos do teste; cliente HTTPS verifica explicitamente essa CA, sem ignorar TLS. Nenhuma chamada ACME ou deploy externo. Recursos de teste são removidos e nenhuma credencial entra no Git/logs.

## Alternatives Considered

- Nixpacks com um processo dev por monorepo: não define corretamente três processos, migrations e artefatos.
- Seed demo com NODE_ENV alterado em produção: viola limite de segurança e cria registros fictícios; rejeitado.
- Bootstrap por rota pública/API key temporária: exposição e implementação descartável; rejeitado.
- Proxies próprios ou domínios diferentes sem necessidade: adicionam configuração e divergem da origem única; usar Traefik do Coolify.
- Confiar em qualquer proxy ou aumentar rate limits para contornar IP agregado: causa raiz permanece; confiança explícita adotada.
- Migration em cada réplica: concorrência operacional e release não coordenada; job único antes do runtime.

## Consequences

Pacote permite instalação inicial no Coolify/Traefik sem mudar as funcionalidades. Operador informa domínio, credenciais e rede/IP do proxy, garante acesso privado à VPS e executa bootstrap explícito. Raw mode exige manter labels/rede e usar nomes únicos. HTTPS/DNS/ACME reais e versão/configuração da VPS precisam de validação no destino; testes locais não comprovam publicação externa.

Não representa conclusão integral da fase 14: backups externos/restore periódico, alertas, retenção legal, RPO/RTO e HA precisam de definição operacional antes de uso com dados reais. Um PostgreSQL/Redis/VPS continuam pontos únicos de falha. Backup antes de releases e rollback somente para imagens compatíveis com schema; não apagar volumes nem reverter SQL cegamente.
