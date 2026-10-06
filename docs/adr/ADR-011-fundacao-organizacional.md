# ADR-011 — Fundação organizacional e API local antes de autenticação

Status: implementado e validado na fase 2. Data: 2026-10-06.

## Context

ADR-006 aprovou User global, OrganizationMembership e vínculos de filial. O roadmap original colocava Team/TeamMember e AuditLog na fase 2 e proibia endpoints de gestão antes de autenticação. A solicitação explícita desta etapa reduz o escopo a Organization, Branch, User e memberships, exige uma API mínima local e adia autenticação/RBAC para a fase 3. Essa alteração precisa ficar explícita; integridade referencial não significa autorização de acesso.

## Decision

Implementar cinco modelos estruturais, preservando a migration técnica anterior. User não contém organizationId nem branchId; e-mail é globalmente único, normalizado por trim/lowercase. PasswordHash será criado com o fluxo real de credenciais na fase 3, sem senha fake, credencial nullable ou login parcial nesta entrega. O administrador demo é apenas uma identidade com esse nome; não possui papel ou privilégios.

Organization.document é opcional, alfanumérico normalizado em maiúsculas, com remoção de espaços e pontuação de apresentação (ponto, barra e hífen). Não há validação fiscal, presunção de CNPJ ou unicidade global sem contexto de país/emissor. Não indexar um campo sem consulta existente. Branch.code é configurável, uppercase e único por organização.

MembershipBranch referencia membership e filial por FKs compostas com organizationId. A filial principal fica em OrganizationMembership; sua FK `(organizationId, id, primaryBranchId)` aponta para `(organizationId, membershipId, branchId)` de MembershipBranch. Assim, precisa estar vinculada à mesma membership, além de pertencer à mesma organização. Criar membership sem filial principal, criar vínculos e atualizar a principal na mesma transação. RESTRICT preserva as referências; uma retirada futura da filial principal deve primeiro limpar ou trocar a principal. Membership sem filiais não concede acesso à organização inteira: concessão ORGANIZATION permanece uma decisão explícita do RBAC futuro.

Organizations possui Organization, Branch e ambos os tipos de vínculo; users possui a identidade global. A infraestrutura organizacional coordena uma transação e chama exclusivamente UserIdentityGateway, export público de users, com o mesmo cliente transacional. O gateway cria/consulta e projeta dados públicos de User; não há acesso à tabela users pelo repository organizacional. Application valida a seleção de filiais e coordena o caso de uso; policies puras não conhecem HTTP/Nest/Prisma. Erros semânticos recebem status HTTP apenas no filtro. Não criar BaseRepository ou interfaces que não tenham necessidade real de substituição.

Expor somente sete operações REST sob `/api/v1/organizations`, temporariamente sem autenticação, para desenvolvimento/testes locais. A API continua vinculada a 127.0.0.1. Não publicar por proxy/túnel/deploy antes dos guards, TenantContext autenticado e permissões da fase 3. Não inventar API key, identidade de operador, TenantContext falso ou middleware descartável. CORS não é autorização; um ID no path apenas seleciona registros. Nenhuma garantia de confidencialidade entre operadores é alegada nesta fase: quem alcança essa API local pode selecionar qualquer organização.

POST users cria identidade nova e membership atomicamente; conflito de e-mail retorna 409 e nunca associa automaticamente uma pessoa de outra organização. POST memberships associa identidade existente explicitamente por UUID. Sem endpoint de diretório global, alteração de perfil ou CRUD completo. Listas filtram organizationId, usam cursor UUID crescente, limite padrão 25/máximo 100 e resposta `{data,pageInfo}`. UUID crescente é uma ordenação estável, não cronológica.

DTOs Zod strict normalizam entradas e rejeitam propriedades extras. Responses são projeções explícitas. OpenAPI vem dos mesmos schemas; a conversão da parte suportada de JSON Schema para OpenAPI 3 falha diante de keywords não suportadas, em vez de remover validações silenciosamente. CHECKs de normalização complementam a validação da aplicação e estão documentados na migration porque Prisma não os representa. Unique constraints resolvem corridas; erros Prisma conhecidos viram 400/404/409 seguros e falhas desconhecidas continuam falhas 500.

Organização inativa bloqueia novas filiais, identidades e memberships; usuário/filial inativos bloqueiam novas associações. As listagens estruturais podem retornar registros inativos para inspeção, sem conferir acesso. Desativação/reativação não têm endpoint nesta etapa. As verificações estão na transação de escrita; não há operação concorrente de desativação exposta nesta fase. Ao implementar esse lifecycle, definir atomicidade com novos vínculos e invalidação de grants/sessões. Não introduzir locking/trigger de autorização antes desse caso de uso.

Sem eventos, outbox, Team, AuditLog ou lógica comercial sem consumidor. Seed transacional de desenvolvimento/teste: uma organização, cinco filiais, uma identidade e membership, cinco vínculos e principal. Upserts não sobrescrevem edição/desativação existente. Seed recusa NODE_ENV=production. Fixtures de teste criam dois tenants em PostgreSQL real isolado, sem usar o banco local persistente.

## Alternatives Considered

- User com organizationId/branchId: viola identidade global aprovada e impede participação em várias organizações.
- FK da principal somente para Branch: permite principal não atribuída à membership; o vínculo composto evita isso.
- Identificar e vincular automaticamente por e-mail: confunde intenção de cadastro com associação de identidade global.
- Criar Team/RBAC/credenciais/outbox agora: antecipa responsabilidades explicitamente excluídas.
- Endpoint fechado por API key provisória: cria uma segurança concorrente e descartável, sem sessão ou autorização real.
- Nenhum endpoint até autenticação: era o gate anterior; a solicitação atual exige validação da API mínima local.
- Document globally unique: pressupõe namespace fiscal único sem país/emissor definidos.

## Consequences

A integridade tenant é reforçada pelo PostgreSQL, inclusive para writes fora da API, e os módulos preservam propriedade dos dados. A FK da principal exige ordem de escrita transacional e lifecycle explícito para retirada de filiais. O banco ainda não contém credenciais ou poderes de administrador. A limitação de segurança local é deliberada e documentada; não é um mecanismo de autorização. Auth e guards precisam proteger estas mesmas operações antes de exposição pública, preservando os casos de uso existentes.

Testar migrations desde banco vazio e atualização da fundação anterior, seed repetido sem alterações, DTOs, constraints, queries filtradas, relações cruzadas e criações concorrentes. Manter toda a cobertura técnica da fase 1. Ver README, DATABASE e ROADMAP para operação e escopo efetivo.
