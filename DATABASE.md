# Estratégia de banco de dados

## 1. Estado e decisões

O ERD abaixo é um modelo **conceitual futuro**, não uma ordem para gerar schema/migrations comerciais. A fase 1 criou InfrastructureMetadata. A fase 2 materializa exclusivamente Organization, Branch, User global, OrganizationMembership e MembershipBranch; consulte a seção de modelo físico atual, README e ADR-011. A fase 3 acrescenta credenciais, sessões e RBAC conforme a seção física ao final e ADR-012. A fase 5 acrescenta Contact, Company, Tag, ContactTag e históricos mínimos de atribuição, conforme ADR-014 e a seção física abaixo. A fase 6 acrescenta leads, pipelines/etapas, oportunidades e históricos mínimos, conforme ADR-015 e a seção física ao final. As fases 7 e 9 acrescentam tarefas/timeline/lembretes e catálogo/preços, descritos nas respectivas seções físicas. A fase 8 está adiada. O restante do ERD continua futuro. Campos e cardinalidades serão refinados por módulo; os limites de tenant e invariantes já são decisões obrigatórias. PostgreSQL com Prisma, schema compartilhado e `organization_id` em entidades tenant. Identidade `User` é global; empresa cliente `Company` é diferente de `Organization`.

UUID gerado pela aplicação/Prisma ou default PostgreSQL compatível com a versão escolhida. Começar com UUID v4; avaliar v7 apenas com suporte real e medição, sem substituir UUID por sequências públicas. Datas `timestamptz` em UTC; frontend converte para fuso da organização/usuário. Horários de automações/metas precisam armazenar também o fuso IANA usado na definição do período para lidar com mudanças de horário.

Prisma models PascalCase, campos camelCase, tabelas/colunas snake_case (`@@map`/`@map`). IDs relacionados usam `organizationId`, `branchId`, `ownerMembershipId`, etc. `createdAt`, `updatedAt` e `version` quando há concorrência relevante. `archivedAt` só em entidades com arquivamento; não aplicar soft delete universal.

## 2. Tenant, identidade e grants

- Organization: tenant contratante, configurações e estado.
- Branch: filial/loja, sempre em uma organização.
- Team: equipe de uma filial, sem concessão implícita de acesso.
- User: identidade global (e-mail e hash de senha), pode participar de várias organizações.
- OrganizationMembership: vínculo User/Organization, ativo/inativo, nome comercial opcional e metadados de vendedor. `unique(organization_id, user_id)`; reativação conserva identidade do vínculo para histórico.
- MembershipBranch: filiais permitidas para carteira/grants de filial de uma membership. Não substitui Role/Permission. Um grant ORGANIZATION autoriza suas ações no tenant inteiro sem enumerar todas as filiais; não expande grants OWN/BRANCH e sua revogação é independente da remoção de uma MembershipBranch.
- TeamMember: membership em equipe, no mesmo tenant; associação precisa de acesso à filial da equipe.
- Role/RolePermission: papéis tenant e permissões do catálogo global.
- UserRole: grant de papel para membership, com scope OWN/BRANCH/BRANCH_SET/ORGANIZATION. UserRoleBranch guarda as filiais do grant. BRANCH exige exatamente uma; BRANCH_SET exige pelo menos uma; ORGANIZATION/OWN não usam linhas de branch grant. Consistência multirow exige transação de application e teste; constraint trigger pode reforçá-la se necessário.

Usuário vendedor não precisa de entidade Seller paralela. OWN compara ownerMembershipId com membership, nunca `User.id` ignorando tenant. Grants de filial devem pertencer às filiais autorizadas da membership. Remover acesso a filial revoga/ajusta grants associados na mesma transação. Configuração de role não permite acesso além da autoridade do concedente.

## 3. Integridade e isolamento obrigatório

Cada tabela tenant inclui `organization_id NOT NULL`, salvo AuditLog global de autenticação explicitamente separado por política. Nas tabelas referenciadas, criar `unique(organization_id, id)` apesar de `id` já ser UUID global, para permitir FKs compostas. Child referencia parent por `(organization_id, parent_id) → (organization_id, id)`.

Exemplos de invariantes físicas:

- Opportunity: FK `(organization_id, contact_id)` para Contact, equivalente para Company, Lead, Branch e owner OrganizationMembership.
- PipelineStage: `(organization_id, pipeline_id)` para Pipeline; `unique(organization_id, pipeline_id, id)`.
- Opportunity: `(organization_id, pipeline_id, stage_id)` para PipelineStage. O mesmo tenant sozinho não impede estágio de outro pipeline.
- OpportunityStageHistory guarda fromPipelineId/toPipelineId e fromStageId/toStageId, com FKs triplas `(organization_id, from_pipeline_id, from_stage_id)` e `(organization_id, to_pipeline_id, to_stage_id)`, oportunidade e ator tenant. Origem pode ser nula na criação; destino é obrigatório. Pipeline de oportunidade não muda por PATCH comum; migração autorizada entre pipelines é caso de uso dedicado que preserva histórico do pipeline anterior.
- Team: branch do mesmo tenant. TeamMember inclui branchId como contexto e pode usar FKs compostas para Team e MembershipBranch, garantindo membership com acesso àquela filial.
- UserRole: membership e Role do mesmo tenant. UserRoleBranch referencia grant+membership e MembershipBranch, além de Branch, para não conceder filial fora do vínculo. Campos redundantes para FKs são controlados pela aplicação e uniques compostos.
- QuoteItem pertence a Quote; PriceListItem pertence a PriceList/Product da mesma organização. Referência de Opportunity/Quote a owner requer membership do tenant, mesmo que inativa posteriormente.
- Conversation é ligada a Channel; Message precisa ter canal e conversa compatíveis. Constraint composta `(organization_id, channel_id, conversation_id)` evita mensagem da conversa em outro canal. MessageAttachment herda tenant e Message.

`branch_id` opcional é uma escolha de compartilhamento, não bypass de acesso. Recursos comerciais atribuídos a filial devem apontar a membership autorizada no momento da atribuição. Em entidades nas quais owner precisa permanecer autorizado na filial, usar FK para MembershipBranch se lifecycle permitir; nos históricos/snapshots, preservar referência à membership e revogar poder, sem apagar autoria ao remover acesso. Regras temporais de carteira precisam de transação e teste, não apenas FK.

Repository sempre recebe contexto tenant e escopo explícitos; update/delete usa predicado tenant+ID+versão quando aplicável. Filtrar também contagens, joins, bulk, nested writes e SQL raw parametrizado. Nenhuma extensão automática Prisma substitui revisão dessas rotas. RLS poderá ser adotada como defesa adicional mediante ADR e testes de connection pooling/contexto/reset; não está implantada nem presumida.

FKs `RESTRICT` para entidades comerciais/históricas, arquivamento para não eliminar oportunidade/orçamento em cascata. Cascata permitida em filhos puramente estruturais descartáveis (por exemplo relação de papel) somente quando a política do caso permitir. Não fazer cascade de Organization para eliminar dados financeiros, mensagens e auditoria indiscriminadamente. Processo de eliminação de tenant é explícito, auditado e sujeito a retenção legal.

## 4. ERD inicial

Tipos são ilustrativos. O diagrama inclui entidades de suporte para memberships, RBAC, sessões, idempotência e execução; campos abreviados não retiram FKs/uniques descritas acima. `organizationId` é obrigatório em todas as entidades tenant, mesmo quando omitido de um bloco resumido. Relações opcionais/múltiplas refletem o modelo conceitual; detalhes físicos estão nos parágrafos seguintes.

```mermaid
erDiagram
    Organization {
        uuid id PK
        string name
        string status
    }
    Branch {
        uuid id PK
        uuid organizationId FK
        string name
    }
    Team {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
    }
    User {
        uuid id PK
        string normalizedEmail UK
        string passwordHash
    }
    OrganizationMembership {
        uuid id PK
        uuid organizationId FK
        uuid userId FK
        string status
    }
    MembershipBranch {
        uuid id PK
        uuid organizationId FK
        uuid membershipId FK
        uuid branchId FK
    }
    TeamMember {
        uuid id PK
        uuid organizationId FK
        uuid teamId FK
        uuid membershipId FK
        uuid branchId FK
    }
    Role {
        uuid id PK
        uuid organizationId FK
        string name
    }
    Permission {
        uuid id PK
        string code UK
    }
    RolePermission {
        uuid organizationId FK
        uuid roleId FK
        uuid permissionId FK
    }
    UserRole {
        uuid id PK
        uuid organizationId FK
        uuid membershipId FK
        uuid roleId FK
        string scope
    }
    UserRoleBranch {
        uuid organizationId FK
        uuid userRoleId FK
        uuid membershipId FK
        uuid branchId FK
    }
    Session {
        uuid id PK
        uuid userId FK
        datetime expiresAt
        datetime revokedAt
    }
    RefreshToken {
        uuid id PK
        uuid sessionId FK
        string tokenHash UK
        uuid predecessorId FK
        datetime usedAt
    }
    PasswordResetToken {
        uuid id PK
        uuid userId FK
        string tokenHash UK
        datetime expiresAt
        datetime usedAt
    }
    Contact {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        uuid ownerMembershipId FK
        uuid companyId FK
    }
    Company {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        uuid ownerMembershipId FK
    }
    Lead {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        uuid ownerMembershipId FK
        uuid contactId FK
        uuid companyId FK
    }
    Pipeline {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
    }
    PipelineStage {
        uuid id PK
        uuid organizationId FK
        uuid pipelineId FK
        decimal position
    }
    Opportunity {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        uuid ownerMembershipId FK
        uuid pipelineId FK
        uuid stageId FK
        uuid contactId FK
        uuid companyId FK
        uuid leadId FK
        int version
    }
    OpportunityStageHistory {
        uuid id PK
        uuid organizationId FK
        uuid opportunityId FK
        uuid fromPipelineId FK
        uuid toPipelineId FK
        uuid fromStageId FK
        uuid toStageId FK
        uuid actorMembershipId FK
        datetime occurredAt
    }
    Task {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        uuid ownerMembershipId FK
        uuid contactId FK
        uuid leadId FK
        uuid opportunityId FK
        uuid conversationId FK
        datetime dueAt
    }
    Activity {
        uuid id PK
        uuid organizationId FK
        uuid actorMembershipId FK
        uuid opportunityId FK
        uuid contactId FK
        uuid leadId FK
        uuid conversationId FK
        uuid quoteId FK
        datetime occurredAt
    }
    Product {
        uuid id PK
        uuid organizationId FK
        string sku
        string status
    }
    PriceList {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        string currency
    }
    PriceListItem {
        uuid id PK
        uuid organizationId FK
        uuid priceListId FK
        uuid productId FK
        decimal unitPrice
    }
    Quote {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        uuid ownerMembershipId FK
        uuid opportunityId FK
        uuid contactId FK
        uuid companyId FK
        uuid priceListId FK
        string status
        int revision
        int version
        decimal total
    }
    QuoteItem {
        uuid id PK
        uuid organizationId FK
        uuid quoteId FK
        uuid productId FK
        string descriptionSnapshot
        decimal quantity
        decimal unitPriceSnapshot
        decimal total
    }
    Channel {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        string medium
        string provider
    }
    WhatsAppInstance {
        uuid id PK
        uuid organizationId FK
        uuid channelId FK
        string providerConnectionNamespace
        string externalInstanceId
        string credentialReference
    }
    Conversation {
        uuid id PK
        uuid organizationId FK
        uuid channelId FK
        uuid branchId FK
        uuid ownerMembershipId FK
        uuid contactId FK
        string externalConversationId
    }
    Message {
        uuid id PK
        uuid organizationId FK
        uuid conversationId FK
        uuid channelId FK
        string externalMessageId
        string direction
        string status
        bigint sequence
    }
    MessageAttachment {
        uuid id PK
        uuid organizationId FK
        uuid messageId FK
        string storageKey
        string scanStatus
    }
    AutomationFlow {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        int version
        json definition
    }
    AutomationExecution {
        uuid id PK
        uuid organizationId FK
        uuid flowId FK
        uuid triggeringEventId FK
        int flowVersion
        json definitionSnapshot
        string status
    }
    AutomationExecutionStep {
        uuid id PK
        uuid organizationId FK
        uuid executionId FK
        string stepKey
        string status
    }
    Goal {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        uuid teamId FK
        uuid ownerMembershipId FK
        string scopeType
        datetime periodStart
        datetime periodEnd
    }
    Notification {
        uuid id PK
        uuid organizationId FK
        uuid recipientMembershipId FK
        uuid sourceEventId FK
        datetime readAt
    }
    AuditLog {
        uuid id PK
        uuid organizationId FK
        uuid actorUserId FK
        uuid actorMembershipId FK
        string action
        string entityType
        uuid entityId
        datetime occurredAt
    }
    WebhookEvent {
        uuid id PK
        uuid organizationId FK
        uuid channelId FK
        string dedupeKey
        string eventType
        json payload
        string status
        datetime receivedAt
    }
    OutboxEvent {
        uuid id PK
        uuid organizationId FK
        uuid parentEventId FK
        string eventType
        string destination
        string status
        datetime availableAt
        datetime leaseUntil
        string leaseToken
    }
    EventReceipt {
        uuid id PK
        uuid organizationId FK
        uuid outboxEventId FK
        string consumer
        datetime processedAt
    }
    IdempotencyRecord {
        uuid id PK
        uuid organizationId FK
        uuid actorMembershipId FK
        string operation
        string keyHash
        string requestHash
        string status
        datetime expiresAt
    }

    Organization ||--o{ Branch : owns
    Organization ||--o{ OrganizationMembership : includes
    User ||--o{ OrganizationMembership : joins
    Branch ||--o{ Team : groups
    OrganizationMembership ||--o{ MembershipBranch : accesses
    Branch ||--o{ MembershipBranch : permits
    OrganizationMembership ||--o{ TeamMember : participates
    Team ||--o{ TeamMember : includes
    Organization ||--o{ Role : defines
    Role ||--o{ RolePermission : grants
    Permission ||--o{ RolePermission : identifies
    OrganizationMembership ||--o{ UserRole : receives
    Role ||--o{ UserRole : assigned
    UserRole ||--o{ UserRoleBranch : restricts
    MembershipBranch ||--o{ UserRoleBranch : bounds
    User ||--o{ Session : opens
    Session ||--o{ RefreshToken : rotates
    RefreshToken o|--o| RefreshToken : succeeds
    User ||--o{ PasswordResetToken : requests

    Organization ||--o{ Contact : owns
    Organization ||--o{ Company : owns
    Company o|--o{ Contact : main_company
    Branch o|--o{ Contact : locates
    Branch o|--o{ Company : locates
    OrganizationMembership o|--o{ Contact : owns_portfolio
    OrganizationMembership o|--o{ Company : owns_portfolio
    Organization ||--o{ Lead : owns
    Branch ||--o{ Lead : receives
    OrganizationMembership o|--o{ Lead : assigned
    Contact o|--o{ Lead : identifies
    Company o|--o{ Lead : identifies
    Organization ||--o{ Pipeline : defines
    Branch o|--o{ Pipeline : specializes
    Pipeline ||--|{ PipelineStage : contains
    Organization ||--o{ Opportunity : owns
    Branch ||--o{ Opportunity : handles
    OrganizationMembership ||--o{ Opportunity : owns_portfolio
    Pipeline ||--o{ Opportunity : organizes
    PipelineStage ||--o{ Opportunity : current_stage
    Contact o|--o{ Opportunity : negotiates
    Company o|--o{ Opportunity : negotiates
    Lead o|--o| Opportunity : converts_to
    Opportunity ||--o{ OpportunityStageHistory : records
    Pipeline o|--o{ OpportunityStageHistory : from_pipeline
    Pipeline ||--o{ OpportunityStageHistory : to_pipeline
    PipelineStage o|--o{ OpportunityStageHistory : from_stage
    PipelineStage ||--o{ OpportunityStageHistory : to_stage
    OrganizationMembership o|--o{ OpportunityStageHistory : acts
    Organization ||--o{ Task : owns
    Branch ||--o{ Task : locates
    OrganizationMembership ||--o{ Task : assigned
    Opportunity o|--o{ Task : follows_up
    Contact o|--o{ Task : follows_up
    Lead o|--o{ Task : follows_up
    Conversation o|--o{ Task : follows_up
    Organization ||--o{ Activity : owns
    OrganizationMembership o|--o{ Activity : acts
    Opportunity o|--o{ Activity : timeline
    Contact o|--o{ Activity : timeline
    Lead o|--o{ Activity : timeline
    Conversation o|--o{ Activity : timeline
    Quote o|--o{ Activity : timeline

    Organization ||--o{ Product : owns
    Organization ||--o{ PriceList : defines
    Branch o|--o{ PriceList : specializes
    PriceList ||--o{ PriceListItem : contains
    Product ||--o{ PriceListItem : priced
    Organization ||--o{ Quote : owns
    Branch ||--o{ Quote : issues
    OrganizationMembership ||--o{ Quote : owns_portfolio
    Opportunity o|--o{ Quote : proposes
    Contact o|--o{ Quote : receives
    Company o|--o{ Quote : receives
    PriceList o|--o{ Quote : price_source
    Quote ||--|{ QuoteItem : contains
    Product o|--o{ QuoteItem : references

    Organization ||--o{ Channel : connects
    Branch o|--o{ Channel : locates
    Channel ||--o| WhatsAppInstance : provider_config
    Channel ||--o{ Conversation : hosts
    Branch o|--o{ Conversation : locates
    OrganizationMembership o|--o{ Conversation : assigned
    Contact o|--o{ Conversation : participates
    Conversation ||--o{ Message : contains
    Channel ||--o{ Message : transports
    Message ||--o{ MessageAttachment : attaches
    Channel ||--o{ WebhookEvent : receives
    Organization ||--o{ WebhookEvent : owns

    Organization ||--o{ AutomationFlow : defines
    Branch o|--o{ AutomationFlow : limits
    AutomationFlow ||--o{ AutomationExecution : executes
    OutboxEvent o|--o{ AutomationExecution : triggers
    AutomationExecution ||--o{ AutomationExecutionStep : checkpoints
    Organization ||--o{ Goal : defines
    Branch o|--o{ Goal : targets
    Team o|--o{ Goal : targets
    OrganizationMembership o|--o{ Goal : targets
    OrganizationMembership ||--o{ Notification : receives
    OutboxEvent o|--o{ Notification : sources
    Organization o|--o{ AuditLog : isolates
    User o|--o{ AuditLog : global_actor
    OrganizationMembership o|--o{ AuditLog : tenant_actor
    Organization ||--o{ OutboxEvent : emits
    OutboxEvent o|--o{ OutboxEvent : derives
    OutboxEvent ||--o{ EventReceipt : deduplicates
    OrganizationMembership ||--o{ IdempotencyRecord : requests
```

Pipeline e Quote precisam de pelo menos um estágio/item ao serem publicados/enviados; rascunhos podem estar vazios. A cardinalidade comercial não implica constraint SQL de mínimo de linhas automaticamente. Manter invariantes no caso de uso transacional. As linhas de ownership Organization no ERD são representativas; todas as demais entidades tenant também têm essa FK.

## 5. Regras por domínio

### Contatos, empresas, leads e oportunidades

Contact pode ter uma Company principal opcional; associação a múltiplas empresas com papéis ficará para requisito concreto. E-mail comercial não é unique. A política inicial de telefone compartilhado foi refinada na fase 5 (ADR-014): Contact exige telefone normalizado único por tenant, sem inferir DDI; Company permite telefone compartilhado. Preservar apresentação e origem. Deduplicação/merge são casos autorizados que mantêm histórico, não deletion automática.

Company pode ter documento fiscal normalizado; unique parcial por tenant para documentos válidos presentes conforme país/política. Não forçar regras brasileiras sobre todas as organizações. Dados e endereço do comprador em quote são snapshots, independentes de futura alteração do contato.

Lead pode começar sem Contact/Company; conversão local opcional gera uma Opportunity e associa/cria Contact/Company. `Opportunity.leadId` é nullable e unique por tenant para impedir conversão duplicada; se o negócio futuramente exigir múltiplas oportunidades por lead, mudar constraint em decisão explícita. Conversão e criação compõem a mesma transação pelos contratos dos módulos.

Opportunity tem filial e proprietário obrigatórios, pipeline/stage coerentes, `version`, status e valores. Contact ou Company pode estar ausente durante negociação inicial; critérios de qualificação/fechamento serão definidos antes do caso de uso. Pipeline organizacional pode ser usado por filiais autorizadas; pipeline de filial não atende outra filial. Stage usa posição estável e desempate por ID, rebalanceamento transacional curto quando necessário. Não exigir posição fracionária única sem estratégia de corrida.

Mover Opportunity grava stage atual, versão, histórico e efeitos obrigatórios na mesma transação. History preserva pipeline/estágio anterior e novo, ator, instante e motivo; fromStage pode ser nulo na criação. Stages usados são arquivados, não excluídos. Mover para outro pipeline exige caso próprio e snapshots de origem/destino no histórico para não destruir a trajetória.

### Tarefas, atividades e metas

Task tem owner/filial, estado, vencimento e conclusão. Follow-up é tarefa com finalidade; não criar scheduler próprio. Task pode não ter alvo; quando tiver, exatamente um alvo primário entre Contact, Lead, Opportunity e Conversation. Activity exige exatamente um alvo primário entre esses e Quote, com ator opcional para sistema. FKs explícitas e CHECK de contagem de referências evitam `entityType/entityId` sem integridade; leituras de timeline podem agregar alvos relacionados através de política autorizada.

Goal tem período/fuso e tipo de escopo. CHECK distingue ORGANIZATION (sem alvo), BRANCH (branch), TEAM (team+branch coerentes) e USER (ownerMembership com branch opcional conforme meta). Métrica/unidade são explícitas; evitar misturar receita, contagem e moeda. Uniques do alvo+período+tipo previnem metas duplicadas quando a regra exigir.

### Produtos, preços e orçamentos

Product/SKU e tabelas de preço são tenant. Produtos podem ser arquivados; quote continua legível. PriceList pode ser organizacional ou da filial. PriceListItem inicialmente um preço vigente por produto/lista: `unique(organization_id, price_list_id, product_id)`. Histórico temporal de preço não é requisito inicial; snapshots garantem contratos anteriores.

Quote tem moeda, comprador/endereços e condições em snapshot, status, revisão, validade, aprovador e datas apropriadas. QuoteItem tem descrição/SKU, quantidade, unidade, preço, desconto, impostos aplicáveis e totais em snapshot. Alterar produto/lista não recalcula quote existente automaticamente. Produto opcional no item permite item avulso se autorizado. A versão aprovada/enviada é imutável; revisão cria nova identidade ligada ao original (`rootQuoteId`/`previousQuoteId`, refinados no módulo), com número/revisão unique por tenant. `revision` sozinho não guarda versões históricas.

Dinheiro/quantidade com `numeric`: proposta inicial amount `numeric(19,4)`, unit price e quantity `numeric(18,6)`. Moeda ISO 4217 explícita; cálculos com Decimal, API strings decimais. Definir moedas suportadas, escala e arredondamento por moeda antes do módulo de quotes; inicialmente apenas moedas de até quatro casas de liquidação. Somar itens arredondados conforme política única documentada e testada; não usar float IEEE-754, nem recalcular aprovação com preços atuais. CHECKs quantidade > 0, valores >= 0 e desconto dentro da política. Totais, limite de desconto e aprovação são regras backend em transação com version check.

### Messaging e integrações

Channel contém medium/provider e escopo comercial. WhatsAppInstance é configuração específica do adapter: namespace de instalação/provedor, externalInstanceId, estado e referência de credencial; nunca API key em texto. `unique(provider_connection_namespace, external_instance_id)` evita mapear uma mesma instância de uma instalação a tenants diferentes. Trocar instância preserva canal/histórico com procedimento explícito; IDs externos sempre incluem namespace/conexão, não apenas nome da instância.

Conversation pertence ao Channel e possui branch/owner conforme distribuição. `unique(organization_id, channel_id, external_conversation_id)` para identificador estável. Inicialmente conversa individual com Contact opcional; grupos/participantes múltiplos exigem modelo explícito futuro. Conversa sem owner não fica aberta a carteiras OWN: fila de atendimento precisa de permissão de triagem.

Message grava direção, estado, sequência, ID local/externo, tempos relevantes, versão e correlação. Unique parcial de mensagem externa por organização+canal+namespace+direção+externalMessageId presente. Outbound ainda sem external ID não colide. Message e Conversation têm canal coerente; múltiplos eventos de status atualizam a mesma Message. Estados/statusHistory quando necessários preservam eventos distintos sem regressão temporal. Sequência unique `(organization_id, conversation_id, sequence)`; allocation/lease de envio transacional e fora da chamada externa.

MessageAttachment guarda chave privada, MIME detectado, tamanho, checksum e estado de quarentena/scan, não blob no PostgreSQL. Autorização de download pelo tenant e conversa; URLs assinadas temporárias não são ACL permanente. Armazenar referência externa apenas para download controlado por adapter.

WebhookEvent de messaging vincula Channel e tenant resolvidos por credencial. Raw payload com limite, acesso restrito/criptografia e retenção curta definida na operação. Envelope indexável separado de JSON. Erro armazenado é sanitizado; sucesso HTTP significa aceitação durável, não processamento. Integrações não-messaging podem ganhar uma referência de conexão tipada em evolução do schema, sem reutilizar Channel para um ERP.

### Automações e notificações

AutomationFlow define steps permitidos e versão. Não suportar código arbitrário nem engine BPMN genérica. AutomationExecution captura versão e snapshot imutável da definição ao começar; alteração de flow não muda execução em andamento. `unique(organization_id, flow_id, triggering_event_id)` quando gatilho for evento; gatilhos agendados usam occurrence key equivalente. AutomationExecutionStep tem unique execução+stepKey e checkpoints de tentativas/resultado; efeitos externos seguem a mesma política de envio incerto.

Notification é persistida por destinatário membership e tem canal/status/leitura. Dedupe por evento+destinatário+tipo de entrega. Push Socket.IO apenas avisa sobre dados já persistidos. ImportJob/ReportJob serão registros de trabalho persistido quando essas features existirem, com status/checkpoint/artifact e autor/escopo; não se adicionam tabelas ou scaffolds vazios nesta fase.

## 6. Unicidade, idempotência e outbox

| Entidade                      | Chave/constraint planejada                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Role                          | tenant+nome normalizado                                                                              |
| RolePermission                | tenant+role+permission                                                                               |
| UserRole                      | tenant+membership+role+scope+identidade do grant; impedir duplicata exata no caso de uso             |
| MembershipBranch / TeamMember | tenant+membership+branch / tenant+team+membership                                                    |
| Product                       | tenant+SKU presente conforme política de arquivamento                                                |
| WebhookEvent                  | tenant+channel+tipo+dedupeKey, derivada da identidade estável do evento                              |
| Message                       | tenant+conexão namespace+canal+direção+externalMessageId presente                                    |
| OutboxEvent                   | tenant+evento de origem+destino quando for derivação, sem bloquear fatos distintos do mesmo agregado |
| EventReceipt                  | tenant+outboxEvent+consumer                                                                          |
| IdempotencyRecord             | tenant+actorMembership+operation+keyHash                                                             |
| Notification                  | tenant+sourceEvent+recipientMembership+deliveryType quando source presente                           |

PostgreSQL unique permite múltiplos NULL; partial uniques devem explicitar quando a identidade existe. Prisma pode não expressar todos os checks/índices parciais; migrations SQL revisadas são a autoridade. Não confiar em find-then-insert para dedupe: a constraint decide a corrida.

Outbox tem eventType/version, aggregateType/ID/versão, destino, payload mínimo, correlationId, availableAt, attemptCount, leaseToken/Until, dispatchedAt/completedAt e erro redigido. LeaseToken protege update de worker com posse antiga. Uma entrega lógica por linha; fanout usa linhas filhas identificadas por parentEventId+destino, criadas transacionalmente, quando necessário.

EventReceipt só é escrito com efeito local e conclusão na mesma transação. Envio externo necessita estado durável próprio; receipt não comprova entrega remota. IdempotencyRecord guarda request hash e resposta mínima/segura ou referência ao resultado, com status em andamento/concluído e retenção maior que a janela de retry documentada. Não incluir tokens ou secrets em respostas armazenadas. Recuperação de IN_PROGRESS usa estado comercial e transação, sem liberar execução só porque o tempo passou.

WebhookEvent + OutboxEvent e Opportunity + History + AuditLog + OutboxEvent relevante são transações locais atômicas. Não criar outbox para GET ou todo UPDATE. Dispatcher e reconciliador seguem `ARCHITECTURE.md`; retenção de receipts/eventos considera backups/replays para não ressuscitar efeitos após limpeza. Estado DISPATCHED não significa COMPLETED. Ao expirar payloads, conservar metadados mínimos de identidade/dedupe enquanto houver referências de AutomationExecution/Notification/receipts; não apagar em cascata o histórico comercial. Hard delete de outbox exige ausência de referências ou migração explícita para um registro de identidade arquivado, além de respeitar a janela de replay. Eventos derivados e receipts têm ordem de limpeza controlada.

## 7. Índices e consultas futuras

Começar pelos padrões de acesso reais; criar índices junto da feature, não todos especulativamente. Índices propostos:

| Consulta                      | Índice candidato                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| carteira de contatos          | `(organization_id, owner_membership_id, created_at DESC, id)` e variante filial se usada                                 |
| leads da filial por status    | `(organization_id, branch_id, status, created_at DESC, id)`                                                              |
| Kanban                        | `(organization_id, pipeline_id, stage_id, position, id)`; filtro filial/owner conforme plano medido                      |
| histórico de oportunidade     | `(organization_id, opportunity_id, occurred_at, id)`                                                                     |
| tarefas pendentes/vencidas    | `(organization_id, owner_membership_id, due_at, id)` parcial para status pendente                                        |
| mensagens paginadas           | `(organization_id, conversation_id, sequence DESC)`                                                                      |
| lista de conversas            | `(organization_id, branch_id, last_message_at DESC, id)`, variante owner se necessário                                   |
| quotes por status/filial      | `(organization_id, branch_id, status, created_at DESC, id)`                                                              |
| notificações não lidas        | `(organization_id, recipient_membership_id, created_at DESC, id)` parcial `read_at IS NULL`                              |
| webhook pendente/falho        | `(status, next_attempt_at, received_at, id)` técnico; consultas tenant também filtradas                                  |
| despacho/reconciliação outbox | parcial `(available_at, id)` para pendentes; `(lease_until, id)` para leases e `(dispatched_at, id)` para não concluídos |
| auditoria                     | `(organization_id, occurred_at DESC, id)` e `(organization_id, entity_type, entity_id, occurred_at)`                     |

Índices técnicos globais de outbox/webhook são acessados apenas por workers operacionais autorizados; não seguem tenant-first porque buscam trabalho de todos os tenants, mas cada item processa em contexto restrito. PostgreSQL não cria automaticamente índice em toda FK; analisar caminhos e adicionar índices úteis.

Evitar N+1, incluir apenas campos necessários, keyset pagination estável e limites de joins/in-lists. Busca textual começa por normalização e índices suportados; `pg_trgm`/full-text só mediante volume e idioma reais. JSONB não substitui colunas/FKs de campos de filtro; GIN apenas para queries medidas. Validar com EXPLAIN (ANALYZE, BUFFERS) em dados sintéticos representativos, nunca rodar consultas de teste pesadas sem autorização em produção. Relatórios pesados saem da request e usam projeções revisadas; não há warehouse ou particionamento automático inicial.

## 8. Migrations, geração e deploy

1. Atualizar schema junto à feature; gerar migration nomeada em snake_case, revisar SQL e drift num banco local descartável.
2. Incluir SQL manual para composite FKs/checks/partial indexes exigidos e testar compatibilidade com introspecção/client da versão Prisma adotada.
3. Gerar Prisma Client; testar banco vazio e migração a partir da release anterior, constraints negativas e consultas importantes.
4. Deploy aplica migrations via job único com credencial DDL separada da aplicação, `migrate deploy`; aplicação não executa migrations em cada bootstrap.
5. Mudança incompatível usa expand (coluna nova nullable/contratos compatíveis) → backfill em batches com checkpoint → validação → contract em release posterior. API e worker antigos continuam funcionando durante a expansão.
6. DDL de grande tabela requer avaliação de locks. `CREATE INDEX CONCURRENTLY` precisa execução compatível fora de transação que o impeça; registrar procedimento e verificação do estado da migration/índice. Não fingir que uma migration transacional serve para todo índice.
7. Backup/restore testado antes de mudança destrutiva. Rollback de app preferido quando schema compatível; forward fix para migrations aplicadas. Reversão de dados só com plano específico/backup. Não editar histórico aplicado, usar `db push` em produção ou resetar dados para contornar drift.

Seeds sintéticos locais determinísticos e repetíveis, sem credenciais padrão de produção. Separar bootstrap necessário do tenant de dados de demonstração. URL de banco validada por ambiente e operação; testes não apontam para banco de desenvolvimento persistente/produção inadvertidamente. Manifests/comandos técnicos foram criados na fase 1. A migration técnica `20261006130000_infrastructure_metadata` permanece imutável. A fase 2 adiciona `20261006144000_create_organization_branch_user_foundation`. Seed transacional/idempotente preserva o marcador foundation/versão 1 e cria somente os dados organizacionais demo descritos no README; recusava NODE_ENV=production e não criava credenciais/permissões na fase 2; a fase 3 usa o bootstrap seguro descrito ao final. Os procedimentos de evolução comercial desta seção continuam planejados.

## 9. Retenção, privacidade e recuperação

Dados comerciais, payloads webhook, outbox/receipts, mídia, audit e logs têm retenções distintas e aprovadas. Definir janela do provedor, dedupe/replay, recuperação de backup e exigência legal antes de jobs de limpeza; não adotar TTL curto arbitrário em evento que pode ser reenviado.

Arquivo/soft delete é lifecycle comercial, não eliminação LGPD. Planejar anonimização/exclusão das referências pessoais, mídia e fornecedores com ledger de exclusões e reaplicação após restore. Audit entityType/entityId é referência forense intencional, sem FK ao objeto que pode ser eliminado; gravação exige validação tenant no caso de uso e payload redigido. Audit ator membership/user pode ser pseudonimizado conforme política, mantendo trilha mínima legalmente justificada.

Backups criptografados, acesso mínimo, PITR quando requerido e exercícios de restore medindo RPO/RTO. Após restore, reconciliar outbox, mensagens e checkpoints externos antes de ativar workers; um backup antigo pode conter estado pendente de um efeito externo já realizado. Suspender reenvio incerto até reconciliação para não duplicar mensagens/ERP. PostgreSQL é ponto único de falha inicial; backup não é alta disponibilidade.

## Modelo físico da fase 2 — histórico

O ERD conceitual acima inclui hash de senha e outros campos futuros; o schema ao término da fase 2 **não possuía passwordHash, roles, sessões, Team ou entidades comerciais**. UUID v4 é gerado pelo Prisma, timestamps timestamptz(6)/UTC, active usa default true e updatedAt é mantido pelo Prisma. Não existe soft delete indiscriminado. Nenhum endpoint de transferência/desativação está implementado.

| Modelo                 | Campos e invariantes atuais                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Organization           | id, name, legalName opcional, document opcional, active, createdAt, updatedAt                              |
| Branch                 | id, organizationId obrigatório, name, code configurável, active, timestamps; unique(organizationId,code)   |
| User                   | identidade global: id, name, email globalmente único, active, timestamps; sem organizationId/branchId/hash |
| OrganizationMembership | id, organizationId, userId, primaryBranchId opcional, active, timestamps; unique(organizationId,userId)    |
| MembershipBranch       | id, organizationId, membershipId, branchId, timestamps; unique(organizationId,membershipId,branchId)       |

```mermaid
erDiagram
    Organization ||--o{ Branch : owns
    Organization ||--o{ OrganizationMembership : contains
    User ||--o{ OrganizationMembership : joins
    OrganizationMembership ||--o{ MembershipBranch : assigns
    Branch ||--o{ MembershipBranch : participates
    MembershipBranch o|--o| OrganizationMembership : primary_for_same_membership
```

MembershipBranch possui FKs `(organizationId,membershipId) → OrganizationMembership(organizationId,id)` e `(organizationId,branchId) → Branch(organizationId,id)`. As duas tabelas parent têm uniques compostas tenant+id para sustentar essas relações. A principal usa FK `(organizationId,id,primaryBranchId) → MembershipBranch(organizationId,membershipId,branchId)`: não pode apontar a outro tenant, outra membership ou filial não atribuída. Todas as FKs usam RESTRICT em delete/update. A principal nullable permite criar membership, vínculos e definir principal na mesma transação; remover sua associação requer limpar/trocar a principal antes. Não há branch órfã nem membership sem organização/identidade. User global legítimo pode possuir memberships em vários tenants, cada um com sua própria principal.

Unicidade de e-mail é no valor canônico trim/lowercase; CHECK users_email_canonical rejeita writes diretos não normalizados. Branch.code usa `[A-Z0-9][A-Z0-9_-]{0,63}` e CHECK correspondente, e nunca enum de lojas. Documento opcional é normalizado para `[A-Z0-9]{1,64}` em maiúsculas, removendo espaços/ponto/barra/hífen; CHECK aceita NULL. Não há unicidade de documento sem definição de país/emissor, validação fiscal ou índice não utilizado. Names são trim/não vazios pela validação do servidor. Esses três CHECKs foram adicionados na migration gerada porque não podem ser expressos no schema Prisma; preservar em migrations futuras e revisar SQL.

Índices implementados são somente PKs, uniques descritas e OrganizationMembership(userId)/MembershipBranch(organizationId,branchId) para lookup/referências reversas. Uniques tenant+id já cobrem as listagens por tenant e cursor UUID crescente; tenant+code cobre código de filial; tenant+membership+branch cobre vínculos. Não criar um índice redundante só em organizationId. Cursor não significa ordem cronológica.

Criações de User e membership/branches/principal são uma única transação. Unique constraints decidem criações concorrentes, sem confiar em find-then-insert; API retorna 409 e não vaza erro Prisma/SQL. Consultas organizacionais têm filtro explícito tenant e limites. Esses controles protegem integridade/seleção de dados, não autorização HTTP: auth/RLS não estão implementados; não expor a API local antes da fase 3. Vínculos vazios não concedem ORGANIZATION.

Seed usa organização demo UUID fixo, usuário por e-mail único, filiais por tenant+code, membership por tenant+user e vínculos por chave composta. Repetir conserva IDs/timestamps e edições existentes. O nome Administrador demo não é uma concessão de poder. A integração aplica ambas as migrations em PostgreSQL/volume novo, repete deploy e seed, verifica constraints e relações cruzadas diretamente no banco e exercita concorrência pela API; o banco de desenvolvimento anterior também recebe a nova migration sem reset.

## Modelo físico incremental — fase 3

Migration `20261006180000_create_auth_sessions_rbac` sucede as duas migrations imutáveis anteriores, gerada por Prisma e complementada somente com checks e constraint triggers PostgreSQL que Prisma não expressa. Nenhuma tabela comercial ou outbox.

User adiciona passwordHash nullable (identidades estruturais sem credencial não autenticam) e securityVersion >=0. Session global inclui userId, membershipId opcional, contextVersion/securityVersion, prazo absoluto, revogação e timestamps. FK (userId,membershipId) → OrganizationMembership(userId,id) impede contexto de outra identidade. Índice (userId,revokedAt) atende revogação por usuário. RefreshToken contém somente tokenHash SHA-256 unique, sessão, predecessor e usedAt. FK (sessionId,predecessorId) → RefreshToken(sessionId,id) impede encadear famílias; predecessor unique impede dois sucessores. Histórico é mantido para detectar reuso, sem delete de gerações durante validade da sessão.

Role: tenant/code unique; Permission: code global unique/domain; RolePermission: PK organizationId/roleId/permissionId, FK tenant/role e permission/domain, CHECK domínio ORGANIZATION. UserRole liga membership/role por FKs tenant compostas, scopeKey canônico (none para OWN/ORGANIZATION, SHA-256 de branchIds ordenados para BRANCH/BRANCH_SET), unique tenant/member/role/scope/scopeKey contra duplicação concorrente. ALL é proibido por CHECK em UserRole. UserRoleBranch referencia (tenant,grant,membership) e (tenant,membership,branch), impedindo concessão fora do vínculo. Constraint triggers deferred verificam BRANCH=1 filial, BRANCH_SET>=1, OWN/ORGANIZATION=0 ao commit; operação inteira é transacional. Grant children descartáveis usam cascade; definição/pessoas/tenant permanecem RESTRICT.

PlatformGrant é exceção separada com userId/permissionId unique, domínio PLATFORM, scope ALL, motivo obrigatório e expiresAt. FKs permission/domain e CHECKs impedem misturar permissões tenant/plataforma. Somente organizations.create existe nesse domínio; não dá acesso irrestrito a dados. Seed opt-in limita a 24h. Não há plataforma grant endpoint nem SUPER_ADMIN automático.

```mermaid
erDiagram
 User ||--o{ Session : owns
 OrganizationMembership o|--o{ Session : selected_context
 Session ||--|{ RefreshToken : generations
 RefreshToken o|--o| RefreshToken : predecessor
 Organization ||--o{ Role : defines
 OrganizationMembership ||--o{ UserRole : receives
 Role ||--o{ UserRole : grants
 Role ||--o{ RolePermission : actions
 Permission ||--o{ RolePermission : catalog
 UserRole ||--o{ UserRoleBranch : scopes
 MembershipBranch ||--o{ UserRoleBranch : bounds
 User ||--o{ PlatformGrant : exceptional
 Permission ||--o{ PlatformGrant : platform_only
```

Sessão por login/dispositivo, refresh consume e successor sob lock de Session, sem transação externa/HTTP. Reuso retorna resultado da transação e só então 401, preservando revogação. Mudança de senha usa compare-and-set credencial/securityVersion e revoga sessões na mesma transação; logout-all incrementa versão. Login concorrente com snapshot antigo não concede acesso após mudança. Grants administrativos bloqueiam memberships em ordem antes de reler autorização; todas as queries/grants levam organizationId.

Seed movido para bootstrap da API, pois hash/roles são responsabilidade dos módulos backend. Prisma config invoca esse bootstrap; packages/database não ganhou domínio. Seed pede SEED_ADMIN_PASSWORD, recusa produção e não redefine hash já existente. Upserts preservam IDs, timestamps e desativações; templates/grants não duplicam. Rotação da senha demo existente utiliza change-password, não a repetição do seed. Retenção/limpeza periódica de sessões expiradas será definida por operação/LGPD quando houver uso real; não remover histórico de refresh de sessões ainda válidas.

A migration incremental `20261006190000_enforce_grant_branch_reparenting` reforça o constraint trigger para verificar tanto o grant antigo quanto o novo em UPDATE de UserRoleBranch. A primeira migration de auth já havia sido testada; permaneceu imutável. O teste de realocação direta confirma rollback se o grant antigo perder sua filial obrigatória.

## Modelo físico comercial — fase 5

Migrations incrementais `20261007120000_create_contacts_companies_tags` e `20261007123000_create_assignment_history`; as quatro migrations anteriores permanecem imutáveis. Este é o modelo implementado, distinto das entidades futuras do ERD conceitual.

```mermaid
erDiagram
    Organization ||--o{ Branch : possui
    Organization ||--o{ OrganizationMembership : possui
    User ||--o{ OrganizationMembership : participa
    OrganizationMembership ||--o{ MembershipBranch : acessa
    Branch ||--o{ MembershipBranch : vincula
    MembershipBranch ||--o{ Contact : atribui_carteira_e_filial
    MembershipBranch ||--o{ Company : atribui_carteira_e_filial
    Organization ||--o{ Contact : isola
    Organization ||--o{ Company : isola
    Organization ||--o{ Tag : possui
    Company o|--o{ Contact : empresa_principal
    Contact ||--o{ ContactTag : classifica
    Tag ||--o{ ContactTag : identifica
    Contact ||--o{ ContactAssignmentHistory : preserva_transferencias
    Company ||--o{ CompanyAssignmentHistory : preserva_transferencias
    OrganizationMembership ||--o{ ContactAssignmentHistory : origem_destino_ator
    OrganizationMembership ||--o{ CompanyAssignmentHistory : origem_destino_ator
    Branch ||--o{ ContactAssignmentHistory : filial_origem_destino
    Branch ||--o{ CompanyAssignmentHistory : filial_origem_destino
    Contact {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        uuid ownerMembershipId FK
        uuid companyId FK
        string normalizedPhone
        string normalizedDocument
        int version
        boolean active
    }
    Company {
        uuid id PK
        uuid organizationId FK
        uuid branchId FK
        uuid ownerMembershipId FK
        string normalizedDocument
        int version
        boolean active
    }
    Tag {
        uuid id PK
        uuid organizationId FK
        string normalizedName
        string variant
        int version
        boolean active
    }
    ContactTag {
        uuid organizationId PK,FK
        uuid contactId PK,FK
        uuid tagId PK,FK
    }
```

### Integridade e política de dados

Contact/Company exigem organizationId, branchId, ownerMembershipId e autores de criação/alteração. FK `(organization_id, owner_membership_id, branch_id)` → MembershipBranch impede owner de outra organização ou sem vínculo na filial; FK `(organization_id, branch_id)` → Branch protege filial tenant. `(organization_id, company_id)` → Company protege associação opcional; ContactTag liga tenant+contact e tenant+tag, com chave composta que impede duplicação. Autores e origem/destino/ator de históricos referenciam OrganizationMembership e Branch pelo mesmo tenant. Todas essas relações usam RESTRICT; não reparentear por alteração de organization_id.

Contact.phone é obrigatório, Company.phone opcional. As apresentações são armazenadas separadas das chaves normalizadas. Normalização remove espaços/ponto/parênteses/hífen e preserva `+` explícito; 7–15 dígitos, sem inferir país/DDI. Telefone local e internacional explícito podem ter chaves diferentes, pois não existe informação para resolver essa ambiguidade. Contact tem unique `(organization_id, normalized_phone)` **inclusive inativos**; Company não tem unique de telefone. E-mail comercial canônico trim/lowercase não é único. User.email continua globalmente único, sem qualquer alteração na identidade.

Documentos presentes têm chave maiúscula alfanumérica (remove espaços/ponto/barra/hífen), unique `(organization_id, normalized_document)` em Contact e Company separadamente. NULL pode ocorrer em vários registros. É um identificador opaco do cadastro, sem CPF/CNPJ, jurisdição ou validação fiscal. Documento igual em tipos/organizações distintos é permitido. A política de Organization.document da fase 2 permanece sem unicidade fiscal. Tag.normalizedName é lowercase, trim e espaços colapsados, unique dentro do tenant. Seis variantes semânticas permitidas, sem classes CSS fornecidas pelo cliente.

CHECKs reforçam canonicalidade das chaves, e-mail, variantes e versão positiva; históricos exigem versão maior que 1. Não substituir migrations por `db push`, que perderia controles SQL. Constraints não autorizam leituras: tenant+scope deve continuar em WHERE e na autorização de associações, inclusive filtros/joins. Campo nullable não concede acesso organizacional.

Contact tem source enum MANUAL/WHATSAPP/MARKETPLACE/WEBSITE/REFERRAL/OUTBOUND/PHONE/IMPORT/OTHER. Representa procedência informada, sem integração WhatsApp ou importador. Notes é texto simples, máximo 4000; frontend não renderiza HTML. active permite desativação sem deletedAt universal. Version e updateMany condicionado previnem lost updates; 409 não remove relações nem gera histórico de alteração falhada.

Transferência de filial/owner grava histórico mínimo na mesma transação. Histórico referencia memberships antigos, não o vínculo MembershipBranch removível, conservando origem/destino. Não é AuditLog completo nem timeline. Criação/edição mantêm IDs de autores e UTC, sem dados pessoais adicionais no log.

### Índices e consultas atuais

| Índice/constraint                                        | Justificativa                                               |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| tenant+id (Contact/Company/Tag)                          | alvo de FKs compostas e lookup tenant                       |
| tenant+normalizedPhone (Contact)                         | dedupe concorrente por telefone                             |
| tenant+normalizedDocument (Contact/Company)              | dedupe e filtro exato de documento presente                 |
| tenant+normalizedName (Tag)                              | dedupe de nome canônico                                     |
| tenant+branch+id (Contact/Company)                       | seleção de filial/grants e joins                            |
| tenant+ownerMembership+id (Contact/Company)              | carteira OWN e filtro de responsável                        |
| tenant+createdAt+id, tenant+updatedAt+id, tenant+name+id | ordenações keyset permitidas com desempate                  |
| tenant+company+id (Contact)                              | clientes relacionados a empresa, ainda filtrados pelo scope |
| PK tenant+contact+tag e índice tenant+tag+contact        | associação idempotente e filtro por tag                     |
| tenant+record+recordVersion (históricos)                 | unicidade por mudança e leitura de histórico do registro    |

Não adicionar índice tenant-only: os prefixos acima atendem esse uso. Substring case-insensitive usa filtros tenant mas B-tree não acelera `%termo%`; novos índices de texto exigem medição. O teste de desempenho cria 2000 contatos sintéticos, executa ANALYZE/EXPLAIN ANALYZE BUFFERS e verifica uso de `contacts_organization_id_created_at_id_idx` na ordenação padrão. Não promete um tempo universal para qualquer filtro/volume.

API seleciona só colunas necessárias, busca limit+1 e pagina depois de filtrar tenant/scope. Rótulos de owners/branches/companies/tags são carregados em lotes: número de queries não cresce uma por linha. Company vinculada fora de companies.read fica oculta. Não há count global, exportação sem limite ou query de todos os usuários no frontend.

### Seed e evolução

Seed principal mantém demo estrutural, senha existente e grants idempotentes, amplia catálogo para 20 permissões (oito estruturais e doze comerciais) e atualiza seis templates **na demo**. Não cria clientes, empresas ou tags fictícios e não concede permissões a todos os tenants existentes. Templates de organizações novas incluem o catálogo comercial. Fixtures sintéticas de CRUD/volume são exclusivas dos bancos isolados de integração/E2E. Nenhuma nova variável de ambiente ou serviço foi necessária.

## Modelo físico incremental — fase 6

A migration `20261007150000_create_leads_pipelines_opportunities` acrescenta sete tabelas, LeadStatus/DealStatus e CHECKs; preserva as seis migrations anteriores. Veja ADR-015 para decisões e RBAC. Nenhuma migration concede roles/permissões. Seed demo continua sem cadastros comerciais fictícios; atualiza seu catálogo/templates de forma idempotente.

```mermaid
erDiagram
  Organization ||--o{ Lead : possui
  Organization ||--o{ Pipeline : configura
  Organization ||--o{ Opportunity : possui
  Branch ||--o{ Lead : carteira
  Branch ||--o{ Opportunity : carteira
  Branch o|--o{ Pipeline : restringe_opcionalmente
  MembershipBranch ||--o{ Lead : responsavel_na_filial
  MembershipBranch ||--o{ Opportunity : responsavel_na_filial
  Pipeline ||--|{ PipelineStage : ordena
  Pipeline ||--o{ Opportunity : organiza
  PipelineStage ||--o{ Opportunity : etapa_e_resultado
  Lead o|--o| Opportunity : conversao_unica
  Contact o|--o{ Lead : associado
  Company o|--o{ Lead : associada
  Contact o|--o{ Opportunity : associado
  Company o|--o{ Opportunity : associada
  Opportunity ||--|{ OpportunityStageHistory : historico_atomico
  PipelineStage o|--o{ OpportunityStageHistory : origem
  PipelineStage ||--o{ OpportunityStageHistory : destino
  Lead ||--o{ LeadAssignmentHistory : transferencias
  Opportunity ||--o{ OpportunityAssignmentHistory : transferencias
  OrganizationMembership ||--o{ OpportunityStageHistory : ator
```

- Lead/Opportunity: UUID, tenant, filial, owner membership, autores tenant, timestamps/version/active. FK `(organization_id, owner_membership_id, branch_id)` → MembershipBranch; demais referências de tenant são compostas. Lead não inclui hash/IDs internos nas respostas.
- Lead: NEW/QUALIFIED/DISQUALIFIED/CONVERTED; conversão consistente com convertedAt+hash SHA-256. E-mail/telefone normalizados; telefone não único. Opportunity tem unique `(organization_id, lead_id)`; valores null permitem oportunidades sem lead.
- Pipeline: unique tenant+normalizedName; filial opcional por FK tenant+branch. PipelineStage: unique tenant+pipeline+name e tenant+pipeline+id; kind imutável no caso de uso; posição não negativa. Ordenação/rebalance sob lock do parent e Pipeline.version. Até 30 etapas no caso de uso, uma OPEN ativa obrigatória.
- Opportunity: FK `(organization_id,pipeline_id,stage_id,status)` → PipelineStage `(organization_id,pipeline_id,id,kind)`, impedindo etapa de outro pipeline ou outcome divergente. Decimal(19,4) não negativo, string no transporte, CHECK de moeda BRL/USD/EUR/GBP e estado/closedAt/lostReason. Não há câmbio/aritmética financeira float.
- StageHistory: FKs tenant+pipeline+stage para origem/destino, autoria membership, snapshots de nomes/status e unique tenant+opportunity+recordVersion. Origem completamente nula somente na versão inicial. Perda exige motivo; retorno OPEN limpa motivo e fechamento na oportunidade. GET ordena recordVersion, usando cursor opaco de identidade do item anterior.
- Históricos de atribuição: mesmas FKs tenant de Contact/Company; versão >1. Não implementam AuditLog geral nem eventos sem consumidor.
- Índices tenant+branch/id, tenant+owner/id, tenant+createdAt/id, tenant+updatedAt/id e tenant+name/id para listas de leads/oportunidades. Kanban usa tenant+pipeline+stage+createdAt/id; etapas usam tenant+pipeline+position/id; histórias usam unique tenant+recurso+version. Sem índices especulativos em todos os campos.
- Regra condicional de pipeline específico de filial é aplicada pelo proprietário do módulo, sob lock compartilhado do pipeline; FKs tenant fornecem proteção adicional de organização. Alterar o pipeline de uma oportunidade não é permitido pelo PATCH.

Banco limpo e upgrade devem receber todas as sete migrations via migrate deploy; seed repetido preserva credenciais/IDs/dados. Não usar db push, modificar migrations aplicadas ou ampliar grants tenant por SQL de migration.

## Modelo físico incremental — fase 7

Migration `20261007200000_create_tasks_activities_reminders` adiciona Task, TaskHistory, Activity, TaskReminder e Notification, além dos enums específicos. As sete migrations anteriores permanecem imutáveis. Não há alteração de grants por SQL nem entidades antecipadas da fase 8. ADR-016 registra critérios de visibilidade, versionamento, geração de lembrete e entrega.

```mermaid
erDiagram
  Organization ||--o{ Task : possui
  MembershipBranch ||--o{ Task : responsavel_na_filial
  OrganizationMembership ||--o{ TaskHistory : autoria
  Task ||--|{ TaskHistory : versao_atomica
  Contact o|--o{ Task : alvo_opcional
  Lead o|--o{ Task : alvo_opcional
  Opportunity o|--o{ Task : alvo_opcional
  OrganizationMembership ||--o{ Activity : autoria
  Contact o|--o{ Activity : alvo_exclusivo
  Lead o|--o{ Activity : alvo_exclusivo
  Opportunity o|--o{ Activity : alvo_exclusivo
  Task ||--o{ TaskReminder : geracao_de_agendamento
  OrganizationMembership ||--o{ TaskReminder : destinatario
  TaskReminder ||--o| Notification : efeito_local_unico
  OrganizationMembership ||--o{ Notification : caixa_privada
```

- Task: FK `(organization_id,owner_membership_id,branch_id)` → MembershipBranch; autores/atualizadores → membership tenant; referências Contact/Lead/Opportunity por tenant+ID. CHECK permite zero ou um alvo. Version/reminderVersion positivos; OPEN implica completedAt nulo e COMPLETED exige instante. Título não vazio; remindAt exige dueAt e não ultrapassa vencimento. Desativação usa active, preservando vínculos e histórico.
- TaskHistory: FK tenant+task e tenant+ator, unique tenant+task+recordVersion; título na ocorrência, tipo da mudança e instante. Leitura usa acesso atual à tarefa/alvo, sem ACL histórica ou cópia de todo estado.
- Activity: autoria membership e FKs compostas para três alvos; CHECK exige exatamente um e descrição não vazia. Imutável pela API desta fase. Timeline consulta também TaskHistory e OpportunityStageHistory existentes, sem duplicar eventos em Activity.
- TaskReminder: FK tenant+tarefa e tenant+destinatário; unique tenant+tarefa+scheduledVersion. Estados PENDING/DISPATCHED/COMPLETED/CANCELED/FAILED, checkpoint availableAt, lease/token, tentativas 0–5 e código de falha seguro. DISPATCHED exige lease completo; demais estados não têm lease; COMPLETED exige completedAt; FAILED exige cinco falhas. Não persiste tokens de sessão ou texto de exceção.
- Notification: FK **(tenant,reminderId,recipientMembershipId)** → TaskReminder **(tenant,id,recipientMembershipId)**, impedindo trocar tenant ou destinatário. Unique no mesmo trio permite somente um efeito por intenção. Projeção de título é autorizada no momento da leitura; banco não guarda cópia de conteúdo comercial nem destinatário User global. readAt torna leitura idempotente.
- Índices: Task tenant+createdAt+id para lista, tenant+owner+dueAt+id para carteira/vencimento, tenant+branch+createdAt+id, tenant+targetID por referência; TaskHistory tenant+createdAt+id e unique de versão; Activity tenant+targetID+createdAt+id; TaskReminder state+availableAt+leaseUntil+id para reconciliação; Notification tenant+recipient+createdAt+id para caixa. Índices auxiliares tenant+id dão suporte às FKs compostas. Sorts alternativos e busca substring não prometem B-tree específico antes de medição.

Task.reminderVersion incrementa somente ao mudar destino, alvo, datas ou lifecycle. Cancelar/agendar é parte da mesma transação da tarefa; título/descrição/prioridade não repetem a entrega. Consumidor conclui intenção e insere Notification na mesma transação, sob locks membership/tarefa/intenção. Sem delete físico automático de falhas/checkpoints: retenção futura precisa preservar a deduplicação. O seed mantém demo estrutural, atualiza 44 permissões e seis templates somente na demo, sem Task/Activity/Notification fictícios.

## Modelo físico implementado — fase 9

Migration incremental `20261008140000_create_products_price_lists`, gerada por Prisma migrate diff e revisada com CHECKs SQL. As oito migrations anteriores são imutáveis. Nenhuma concessão de privilégio na migration. ADR-017 registra catálogo e a execução da fase 9 independente da fase 8 adiada.

| Modelo        | Relacionamentos e invariantes                                                                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product       | Organization obrigatória; autores por `(organizationId,membershipId)`; SKU obrigatório uppercase/ASCII unique tenant inclusive arquivados; name/unidade não vazios; active e version >= 1.                                               |
| PriceList     | Organization obrigatória, Branch opcional por FK `(organizationId,branchId)`; autores tenant; normalizedName único no tenant inclusive arquivadas; moeda BRL/USD/EUR/GBP; active/version. Moeda e filial imutáveis pela API.             |
| PriceListItem | FKs `(organizationId,priceListId)` e `(organizationId,productId)`; autor de atualização tenant; unique `(organizationId,priceListId,productId)`; numeric(18,6) não negativo; active e timestamps. Versionamento é do agregado PriceList. |

```mermaid
erDiagram
  Organization ||--o{ Product : owns
  Organization ||--o{ PriceList : defines
  Branch o|--o{ PriceList : specializes
  PriceList ||--o{ PriceListItem : contains
  Product ||--o{ PriceListItem : priced
  OrganizationMembership ||--o{ Product : authors
  OrganizationMembership ||--o{ PriceList : authors
  OrganizationMembership ||--o{ PriceListItem : updates
```

FKs são RESTRICT para exclusão/mudança de tenant; não há hard delete nem deletedAt automático. Arquivamento conserva preços e identidades únicas. Índices tenant+name/createdAt/updatedAt+id atendem as três ordenações keyset usadas; tenant+branch+id restringe listas, tenant+list+id pagina itens e tenant+product atende referências e integridade. Uniques também atendem buscas de SKU e produto/lista. Busca substring não é acelerada por B-tree; medir antes de trigram/full-text.

SKU é normalizado na fronteira; CHECK impede chave não normalizada em SQL direto. Nome normalizado de lista colapsa espaços e usa lowercase, coerente com CHECK existente de catálogos. Unidade é texto escolhido na criação, fixo pela API para não reinterpretar preços; sem classificação fiscal ou conversão. DTO aceita até 12 inteiros/seis decimais por preço e rejeita precisão excedente antes da coerção numeric; SQL numeric possui sua semântica nativa de escala. API serializa preço em string com seis casas, inclusive zero. Sem valores IEEE-754 ou conversão cambial.

Mutações de preço travam lista, verificam expectedVersion e produto ativo sob lock; incrementam versão/autor da lista na mesma transação. Produto arquivado preserva preços anteriores, porém não recebe novos preços. Item arquivado pode ser reativado explicitamente com preço informado e versão vigente. Não há histórico temporal do preço nesta fase; snapshots de documentos pertencem à fase 10 e deverão preservar o valor então contratado.

Seed atualiza idempotentemente apenas demo e provisionamento de novas organizações para 48 permissões (quatro novas: products.read/manage, price-lists.read/manage). Não cria produtos/listas/preços fictícios nem amplia todos os grants de tenants existentes. UI usa projeções explícitas, sem campos internos de autores/tenant. A integração testa banco limpo, seed repetido, FK cruzada, uniques/corridas, decimal exato, escopos e preservação de referências.
