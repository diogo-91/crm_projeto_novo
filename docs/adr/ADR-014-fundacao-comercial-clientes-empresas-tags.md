# ADR-014 — Fundação comercial: clientes, empresas e tags

Status: Aceito

Data: 2026-10-07

Escopo: Fase 5; complementa ADR-006/009/012/013 e substitui a política inicial de telefone não único do desenho conceitual.

## Context

A estrutura organizacional, autenticação, grants e interface já existem. A fase 5 exige cadastros comerciais reais, mantendo identidade global, autorização por membership, isolamento de tenant e interfaces públicas de módulos. Clientes e empresas precisam de carteira, filial, busca, associação, desativação e tratamento correto de alterações concorrentes. As permissões de administração estrutural não concedem acesso comercial implicitamente.

O desenho inicial permitia telefones compartilhados. A solicitação desta fase prefere impedir duplicação por telefone dentro da organização. Também exige histórico mínimo nas transferências e cache que não reutilize dados privados após mudança de organização ou escopo. Não há consumidor assíncrono, integração externa ou requisito para AuditLog completo.

## Decision

### Modelo e integridade

- Contact é pessoa cliente; Company é empresa cliente B2B, distinta de Organization. Ambos pertencem a uma organização e têm filial e ownerMembershipId **obrigatórios**. O proprietário é OrganizationMembership, nunca User global.
- O owner deve possuir MembershipBranch da filial atribuída. FK `(organizationId, ownerMembershipId, branchId)` aponta a `(organizationId, membershipId, branchId)`. Alterar carteira exige ação autorizada e vínculo ativo; remover esse vínculo exige transferir seus registros antes. ORGANIZATION permite atuar em qualquer filial do tenant, mas não torna um proprietário sem vínculo elegível para aquela filial.
- Contact tem uma Company principal opcional, por FK `(organizationId, companyId)`. A associação também exige companies.read no escopo do objeto. A leitura de contato não concede acesso à empresa; a projeção oculta a empresa se ela não estiver visível ao solicitante. Filtros por companyId revalidam acesso à empresa, inclusive inativa.
- Tags são catálogo organizacional; ContactTag tem FKs compostas para Contact e Tag e PK `(organizationId, contactId, tagId)`. Não há tagging polimórfico nem tags de Company nesta etapa. Leitura de catálogo exige tags.read de um grant válido; o catálogo não contém dados de outras carteiras. Gestão exige tags.manage/ORGANIZATION.
- Todos os vínculos comerciais, autores e históricos têm FKs tenant. Exclusão física e mudança de chave de tenant são RESTRICT. `active=false` é a desativação; não há deletedAt universal, DELETE físico, merge ou reativação implícita. Relações e identificadores únicos continuam preservados após desativação.
- Contact/Company conservam createdByMembershipId e updatedByMembershipId. Transferências produzem ContactAssignmentHistory ou CompanyAssignmentHistory na **mesma transação**: origem/destino de filial e owner, ator, horário UTC e versão resultante. Históricos referenciam Branch/Membership, preservando responsáveis antigos mesmo após retirada de seu acesso à filial. Não constituem um AuditLog completo nem uma timeline. Alterações sem transferência não criam históricos de atribuição.

### Normalização e duplicação

- Telefone obrigatório de Contact: entrada de apresentação aparada; chave normalizada remove espaços, ponto, parênteses e hífen, preserva `+` explícito e exige 7–15 dígitos. **Nenhum DDI é inferido**. Unique `(organizationId, normalizedPhone)` inclui inativos. Uma corrida produz um cadastro e um 409; consultas prévias não substituem a constraint.
- Telefones locais e internacionais explícitos podem representar o mesmo número sem compartilhar a mesma chave. Corrigir essa ambiguidade exige país/contexto real e uma futura decisão de normalização; não assumir Brasil. Compartilhamento de um telefone por pessoas diferentes não é permitido neste cadastro inicial. É uma escolha funcional explícita, não uma promessa de deduplicação universal.
- Telefone de Company é opcional e não único: estabelecimentos podem compartilhar centrais. E-mails de Contact/Company usam trim/lowercase e **não são únicos**; User continua com identidade/e-mail global único.
- Documento opcional preserva apresentação e usa chave maiúscula alfanumérica, removendo espaços, ponto, barra e hífen. Unique `(organizationId, normalizedDocument)` **por tipo de entidade**, permite múltiplos NULL. É identificador cadastral opaco dentro do tenant, sem inferir CPF/CNPJ, país ou validade fiscal. Colisões entre emissores/countries devem ser resolvidas por modelagem explícita antes de ampliar esse requisito. Organization conserva sua política anterior sem unicidade fiscal global.
- Tag.name é aparado; normalizedName colapsa espaços internos e usa lowercase. Unique tenant+normalizedName. `variant` só aceita tokens neutral/primary/success/warning/danger/info; sem CSS arbitrário.
- CHECKs SQL reforçam as chaves normalizadas, e-mails, variantes e versões. Requests Zod estritos rejeitam campos extras. Dados passam para Prisma por mapeamento explícito; campos internos não compõem respostas públicas.

### Permissões e escopos

Novas ações: contacts.read/create/update/delete/assign, companies.read/create/update/delete/assign, tags.read/manage. `assign` é distinto de update. Transferência exige autorização update sobre a origem, update sobre o destino e assign sobre origem/destino. Na criação para outra pessoa, create e assign devem cobrir o destino.

| Template tenant | Contatos e empresas              | Tags        | Escopo sugerido para atribuições |
| --------------- | -------------------------------- | ----------- | -------------------------------- |
| ADMIN           | read/create/update/delete/assign | read/manage | ORGANIZATION                     |
| DIRECTOR        | read/create/update/assign        | read        | ORGANIZATION                     |
| SALES_MANAGER   | read/create/update/assign        | read        | BRANCH ou BRANCH_SET explícito   |
| SELLER          | read/create/update               | read        | OWN                              |
| AFTER_SALES     | read/update                      | read        | OWN                              |
| VIEWER          | read                             | read        | OWN                              |

Templates são dados. O scope efetivo é o UserRole concedido, não uma comparação de nome nem um scope embutido na definição do papel. Grants compostos não emprestam scopes entre ações. OWN limita owner à membership atual e às filiais vinculadas; BRANCH e BRANCH_SET usam as filiais do grant intersectadas com MembershipBranch; ORGANIZATION cobre apenas o tenant atual para aquela ação.

O catálogo é inserido idempotentemente e templates são atualizados **somente na organização demo pelo seed** e na criação autorizada de novas organizações. As migrations estruturais não concedem permissões automaticamente a organizações já existentes. Organizações preexistentes fora da demo conservam suas autorizações; concessões futuras exigem uma ação administrativa explícita e revisada. Nenhuma ampliação global de grants por SQL.

### API, concorrência e módulos

Controllers finos em contacts/companies/tags; application services coordenam seus repositories, que concentram Prisma/transações. Contacts consulta CompaniesLookupGateway, TagsLookupGateway e CommercialDirectoryGateway pelos exports públicos. Os gateways de integração com transações ficam em infrastructure, sem Prisma em application/domínio. Companies não importa Contacts: seus clientes relacionados são consultados pelo endpoint normal de contatos, com filtro companyId e política independente.

Endpoints usam `/api/v1`, bearer e TenantContext derivado da sessão, nunca organizationId recebido como autorização. Listas filtram tenant/escopo **antes** da paginação keyset existente `{data,pageInfo}`. Contatos/empresas ordenam por name/createdAt/updatedAt e id como desempate; cursor opaco valida sort/direction. Tags e diretórios usam cursor UUID. Default 25, máximo 100; sem contagem global ou seleção sem limite. Lookups de filiais/responsáveis são paginados e autorizados pela ação create/update/read indicada, permitindo roles com create sem read.

PATCH e DELETE exigem expectedVersion; updateMany condicionado por tenant/id/version incrementa versão atomicamente. Versão obsoleta gera 409 e rollback dos vínculos/históricos. Revalidação de contexto e grants sob lock de membership reutiliza o mecanismo existente. Erros seguem Problem Details: 400 entrada, 401 sessão, 403 capacidade/destino, 404 objeto indisponível/fora de scope, 409 duplicação/conflito, 503 dependência. DELETE desativa e retorna 200 com DTO; nunca remove associações.

Projeções de listas buscam rótulos de filiais, owners, empresas e tags em lotes; não há query por registro. Índices B-tree atendem tenant/filial/owner/ordenação e joins. Busca substring case-insensitive continua limitada ao tenant com paginação; B-tree não acelera `%termo%`. Volume maior deve ser medido antes de incluir trigram/full-text, sem introduzi-los preventivamente.

Logs comerciais usam event type, IDs de organização/membership/entidade e requestId/correlationId via AsyncLocalStorage. Não registram nome, telefone, documento, e-mail, notas, credenciais ou payload completo. Nenhum novo job, fila, outbox ou evento sem consumidor.

### Frontend e cache

TanStack Query **5.104.1**, compatível com React 19, é a única nova dependência direta. Reutiliza ApiClient/SessionClient; não possui tokens próprios, persistência de cache, BFF ou autenticação paralela. Client e query keys incluem organização, membership e `cacheScopeKey` fornecida pelo backend. `/auth/me` e respostas de sessão acrescentam hash SHA-256 canônico dos grants completos e filiais vinculadas; quando a sessão recebe contexto atualizado, a troca dessa chave desmonta o cache antigo. Mudanças de identidade/contexto/logout cancelam requests e limpam dados.

A chave é metadado de invalidação, **nunca autorização**, não contém secret e não permite consultar registros. O backend continua relendo grants atuais em cada request. O frontend não reproduz scopes nem recebe listas globais para filtragem local. Não há promessa de detecção instantânea de revogação sem uma nova consulta/refresh; resposta 401/403/404 não concede acesso nem é convertida em sucesso.

Contratos da resposta de contexto são estritos: API/web devem ser lançadas juntas ao acrescentar cacheScopeKey. Não há alteração de JWT ou armazenamento de access. A revisão da interface usa URL para filtros, debounce de busca, paginação real e loading/empty/error/forbidden. Formulários RHF/Zod preservam dados após conflito e omitirem relações não alteradas preserva associações fora do scope atual. Primitives/tokens ficam em packages/ui. Dialogs programáticos usam callbacks de foco oficiais do Radix, com retorno ao disparador ainda presente; sem delays ou seletores improvisados.

### Migrations e validação

Duas migrations incrementais: `20261007120000_create_contacts_companies_tags` e `20261007123000_create_assignment_history`. As quatro anteriores permanecem imutáveis. PostgreSQL real valida instalação limpa, seed repetido, constraints cruzadas, escopos dos dois recursos, concorrência, rollback e plano de consulta. Browser real valida jornada comercial, isolamento após troca de contexto, sessão, acessibilidade e cinco larguras. Seed principal não cria dados comerciais fictícios; fixtures sintéticas ficam nos bancos isolados dos testes.

## Alternatives Considered

- Owner User global: incompatível com memberships e isolamento aprovado.
- Filial nula/carteira organizacional sem proprietário: torna OWN ambíguo; dispensada para estes cadastros.
- Autorizar só no controller ou filtrar arrays após buscar: expõe objetos, paginação e associações indevidas.
- Telefone sempre não único: alternativa válida para famílias/centrais, substituída por requisito explícito desta fase para Contact; mantida para Company.
- DDI brasileiro automático ou biblioteca fiscal central: presume jurisdição não definida.
- Tag polimórfica, interface BaseRepository e AuditLog/outbox completo: sem necessidade concreta nesta fase.
- Atualizar todos os papéis de todos os tenants por migration: ampliação de privilégios sem decisão administrativa de cada organização.
- Cache indexado só por URL ou organização: mistura identidades e scopes, inclusive permissões iguais com filiais diferentes.
- Lookup de todas as empresas/owners e filtro local: aumenta payload e cria vazamento entre carteiras.

## Consequences

FKs e uniques protegem writes diretos e corridas; políticas de objeto protegem visibilidade. Transferências preservam rastreabilidade mínima sem antecipar auditoria completa. Desativados ocupam suas chaves únicas. Respostas e caches mantêm isolamento com releases coordenados. Listagens têm custo em lotes e limites explícitos; substring pode exigir índices adicionais quando houver evidência real. Um telefone compartilhado requer alteração consciente de política antes de ser aceito. Migração de produção e concessão comercial a tenants existentes continuam exigindo autorização específica.
