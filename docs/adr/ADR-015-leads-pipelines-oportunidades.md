# ADR-015 — Leads, pipelines, conversão e oportunidades

- Status: aceito
- Data: 2026-10-07
- Escopo: fase 6, autorizada explicitamente pelo solicitante
- Complementa: ADR-006, ADR-007, ADR-009, ADR-012 e ADR-014

## Context

A fundação comercial possui contatos, empresas, memberships, filiais e grants reais. É necessário qualificar interesses, converter um lead sem cadastros parciais e acompanhar negociações em etapas configuráveis. A mesma identidade pode operar em organizações diferentes; scopes devem continuar associados à ação do mesmo grant. A equipe pequena deve preservar o monólito modular e as transações locais sem filas/eventos sem consumidores.

## Decision

### Propriedade e dependências

Leads owns Lead e LeadAssignmentHistory. Pipelines owns Pipeline/PipelineStage. Opportunities owns Opportunity, OpportunityStageHistory e OpportunityAssignmentHistory. Leads depende dos gateways públicos de Contacts, Companies e Opportunities. Opportunities depende de Pipelines, Contacts e Companies, sem dependência de volta para Leads. A FK Opportunity → Lead não exige uma dependência de módulos em sentido contrário.

Contacts/Companies expõem criação dentro de transação pelo gateway existente ou específico. A criação HTTP e a conversão utilizam **uma implementação** de persistência/validação por entidade. Apenas infrastructure compartilha DatabaseTransaction. Nenhum controller/application recebe Prisma, escreve entidade alheia ou chama HTTP interno. Projeção de oportunidade mostra pipeline/etapa atuais por gateway público: metadados mínimos dos IDs obtidos após autorização do agregado, incluindo etapas arquivadas; não retorna todo o catálogo por associação. Contatos/empresas relacionados e oportunidade de um lead aparecem somente conforme o scope de leitura dessas entidades.

### Lead e conversão

Lead exige filial e ownerMembershipId ligado àquela filial. Nome, telefone opcional, e-mail opcional, empresa prospectada opcional, origem e observações são dados de prospecção. Telefones de leads não são únicos: interesses/campanhas podem se repetir. Não há associação automática por telefone/e-mail, sobretudo de registros ocultos. Relacionamentos selecionados precisam existir, estar ativos e ser legíveis pelo ator.

Estados: NEW, QUALIFIED, DISQUALIFIED e CONVERTED. Qualificação/desqualificação usam PATCH com expectedVersion; CONVERTED só é definido pela conversão. A conversão exige lead ativo/QUALIFIED e versão atual. Lead convertido fica imutável para edição; desativação preserva o vínculo/histórico.

Conversão trava a membership do ator, revalida sessão/grants, trava o lead e executa criação opcional de Company/Contact, criação de Opportunity+histórico inicial e atualização de Lead **numa transação PostgreSQL**. Requer leads.convert e leitura do lead; opportunities.create/read e pipelines.read para o destino; criação/assign/leitura de cliente/empresa somente quando efetivamente usadas. Filial e responsável são preservados, sujeitos aos scopes de cada ação. Nova Company exige companyName; novo Contact exige telefone. Não cria contatos/empresas implicitamente.

Deduplicação local: unique `(organizationId, leadId)` em Opportunity e SHA-256 da intenção normalizada na conversão. Hash não contém expectedVersion e normaliza zeros decimais; distingue preservar relacionamento omitido de removê-lo explicitamente com null. Retries concorrentes de intenção igual retornam o mesmo resultado; outra intenção retorna 409. Retry revalida leitura/convert e nunca retorna oportunidade inacessível. Conflito de telefone do novo contato gera rollback de todos os registros; usuário pode selecionar um contato existente autorizado. Não existe framework de idempotência, outbox ou job nesta etapa.

### Pipeline e etapas

Pipeline é catálogo da organização, com filial opcional: null disponibiliza-o a todas as filiais autorizadas da organização. Pipeline de filial é legível apenas para scopes que abrangem essa filial. Leitura exige pipelines.read de grant válido; OWN utiliza filiais vinculadas, BRANCH/BRANCH_SET intersectam as filiais do grant com MembershipBranch. Gestão exige pipelines.manage/ORGANIZATION e leitura para a projeção retornada. Um scope organizacional de outra ação não amplia essa gestão.

Nome normalizado é único por organização; etapas têm nomes normalizados únicos no pipeline. Até 30 etapas; pelo menos uma OPEN ativa deve permanecer. kind é OPEN/WON/LOST e imutável após criação. Etapa desativada permanece em oportunidades e históricos; novas entradas nela são rejeitadas. Pipeline arquivado bloqueia novas oportunidades e movimentações, conservando consultas. Filial do pipeline é fixa nesta fase.

Ordenação: inteiros espaçados por dez, desempate por UUID; reorder contém todas as etapas, inclusive inativas, exatamente uma vez. Todas as alterações de configuração incrementam Pipeline.version sob lock do pipeline. Não há unique de posição que obrigue mudanças temporárias ou posições negativas. Movimentação/criação utiliza lock compartilhado no pipeline, serializando decisões sobre configuração/arquivamento com a alteração administrativa.

### Oportunidade e histórico

Oportunidade exige filial/owner, pipeline e etapa. Criação somente em etapa OPEN. PATCH altera dados e atribuição autorizada, sem trocar pipeline/etapa/status. Movimentação específica exige opportunities.move para o registro e expectedVersion, utiliza destino ativo do mesmo pipeline e incrementa versão junto ao histórico. Movimento para a mesma etapa retorna 409 sem histórico artificial. Mudança de pipeline será outro caso de uso futuro; não existe transferência implícita neste PATCH.

WON define closedAt e limpa lostReason; LOST exige motivo não vazio e define closedAt; OPEN reabre e limpa ambos. Valores são Decimal PostgreSQL numeric(19,4), transportados como strings; moedas inicialmente permitidas: BRL/USD/EUR/GBP. Nenhuma conversão cambial ou soma de moedas diferentes; ampliar a lista requer contrato/CHECK compatíveis e teste. Não usar number para cálculos financeiros.

History registra entrada inicial, origem/destino, nomes/outcomes na ocorrência, motivo de perda, ator membership, versão e UTC. Origem nula só na criação. FKs das etapas contêm organização, pipeline e etapa; FK da etapa corrente também contém status→kind. CHECKs reforçam resultados e campos de fechamento. History é paginado em recordVersion ascendente; não ordena cronologia por UUID aleatório. Arquivamento/desativação não apaga histórico. Histórico de reatribuição é mínimo, local e atômico, como na fase 5; não é AuditLog/timeline geral.

### Segurança e interface

Permissões novas: leads.read/create/update/delete/assign/convert; pipelines.read/manage; opportunities.read/create/update/delete/assign/move. O catálogo contém 34 permissões; as migrations não concedem privilégios a tenants existentes. Seed atualiza somente demo; provisionamento autorizado de nova organização instala templates. Organizações anteriores fora da demo precisam de concessão administrativa explícita pelo mecanismo existente.

| Template      | Leads                                         | Oportunidades                             | Pipeline                           |
| ------------- | --------------------------------------------- | ----------------------------------------- | ---------------------------------- |
| ADMIN         | ler/criar/editar/desativar/atribuir/converter | ler/criar/editar/desativar/atribuir/mover | ler/gerir                          |
| DIRECTOR      | ler/criar/editar/atribuir/converter           | ler/criar/editar/atribuir/mover           | ler/gerir com scope organizacional |
| SALES_MANAGER | ler/criar/editar/atribuir/converter           | ler/criar/editar/atribuir/mover           | ler                                |
| SELLER        | ler/criar/editar/converter                    | ler/criar/editar/mover                    | ler                                |
| AFTER_SALES   | ler/editar                                    | ler/editar/mover                          | ler                                |
| VIEWER        | ler                                           | ler                                       | ler                                |

Templates não definem scope nem autorizam pelo nome. Queries aplicam tenant/scope antes da paginação. PATCH/DELETE/transition rejeitam versão obsoleta; reatribuição exige update/assign nas origens e destinos e vínculo ativo. FKs compostas protegem tenant/owner/filial/relações comerciais e histórico. Associação de pipeline de filial com oportunidade de outra filial é verificada no caso de uso sob lock; tenant das duas relações também é protegido pelo banco.

Web reutiliza SessionClient e TanStack Query por organização/membership/cacheScopeKey. `/leads`, `/leads/[id]`, `/crm`, `/crm/[id]` e `/pipeline` usam API real. Kanban pagina cada coluna em 25 registros, sem total calculado sobre subconjunto. Drag abre confirmação; botão Mover permite a mesma ação por teclado e pede motivo em LOST. Mutação autorizada faz update otimista de detalhe/colunas com snapshots, rollback em erro e refetch após settlement. Mantém cursores durante o estado otimista; servidor é autoridade final. Sem persistência de cache/token, filtro de tenant no cliente ou transporte paralelo.

## Alternatives Considered

- Conversão por requests HTTP sequenciais: permite cadastros parciais e duplicações após timeout; rejeitada.
- Domínio de Leads criando linhas de Contact/Company diretamente: duplica invariantes e rompe ownership; rejeitado.
- Outbox, filas e eventos de venda sem consumidor: acrescentam operação sem benefício concreto; rejeitados.
- Pipeline com owner e scope comercial genérico: não expressa catálogo compartilhável entre carteiras; política explícita adotada.
- unique de posição com swaps temporários: exige estados artificiais; lock/version/rebalance adotados.
- Atualizar estágio e histórico fora da transação ou confiar no drag para validar permissão: risco de inconsistência/vazamento; rejeitado.
- Float/number para valores ou enum fixo de nomes de etapas: perde precisão ou configuração; rejeitados.

## Consequences

As transações locais garantem rollback e dedupe de conversão, com critérios de autorização por ação. Alterações concorrentes têm resposta 409; podem exigir recarregar dados antes de novo intento. Names de estágio históricos permanecem estáveis após renomear configuração. Dependências ficam acíclicas e nenhum serviço externo/queue é necessário. O lock de membership reutiliza a política existente e serializa escritas do mesmo ator; medir contenção antes de crescimento. Busca substring é paginada, com índices de ordenação/tenant; índices trigram exigirão medição de carga, não são adicionados automaticamente.

Sem fase 7, recuperação de senha, WhatsApp, cotações, automações, realtime novo ou auditoria completa. Nenhum privilégio é ampliado globalmente ao aplicar a migration. Não há hard delete nem restauração administrativa de pipeline nesta fase; registros arquivados seguem acessíveis por referência/URL autorizada.
