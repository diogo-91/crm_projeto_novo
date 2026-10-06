# ADR-006 — Identidade global, tenants e RBAC por escopo

Status: identidade/memberships implementados na fase 2; RBAC implementado na fase 3 (ADR-012); Team futuro. Data: 2026-10-06.

## Context

Uma pessoa pode trabalhar em várias lojas ou organizações. Hierarquia Organization→Branch→Team→User é operacional, não exclusividade de vínculo. Papéis fixos ADMIN/SELLER não expressam carteiras, múltiplas filiais e permissões de aprovação/relatório.

## Decision

User global, OrganizationMembership por tenant, MembershipBranch e TeamMember. Branch é loja; Company é cliente B2B. Entidades comerciais incluem organizationId e branch/owner quando pertinentes; FKs compostas e TenantContext obrigatório.

Role tenant, Permission global, RolePermission e UserRole por membership. UserRole contém escopo OWN, BRANCH, BRANCH_SET ou ORGANIZATION; UserRoleBranch especifica filiais permitidas. Cada decisão de acesso avalia permissão e escopo do **mesmo grant**, limitado às filiais da membership para escopos OWN/BRANCH/BRANCH_SET. ORGANIZATION concede suas ações no tenant inteiro, incluindo filiais futuras, sem ampliar outros grants. Não combinar permissão restrita de um papel com scope amplo de outro papel sem aquela ação.

Grants, carteira e gestão são autorizados por recurso; remover membership/filial/grant invalida autorização, caches e sockets. O servidor valida organização ativa, não confia em organizationId enviado. Jobs/relatórios/uploads/realtime seguem as mesmas regras. ORGANIZATION é concessão explícita; equipe não concede permissão por associação.

Retirar uma filial do vínculo não revoga um grant ORGANIZATION; seu poder precisa ser retirado explicitamente.

Tenant roles não abrem acesso global de plataforma. Eventual suporte com acesso excepcional precisa de mecanismo separado, prazo, motivo e audit. Administração não permite conceder autoridade acima da própria.

## Alternatives Considered

- User preso a uma Branch: simples, mas duplica identidade e impede acesso legítimo a múltiplas lojas.
- Papel string e checks ADMIN: poucos campos, porém mistura função com acesso aos registros e permite exceções perigosas.
- Tenant por banco desde o início: isolamento físico mais forte e operação mais cara; segue aberto se regulação/escala exigir.
- Só organizationId no body: identificação manipulável; não é autorização.

## Consequences

Suporta multiempresa/multiloja desde a modelagem com custo de joins e matriz de testes. Recursos sem filial/dono precisam de política explícita; NULL não amplia acesso. Isolamento exige cobertura de queries e objetos em todos os transportes, não apenas guard HTTP.

Ver DATABASE.md para FKs; ARCHITECTURE.md para avaliação de escopos. O escopo original foi concretizado na fase 3 conforme ADR-012.

A fase 2 materializa User global, OrganizationMembership, MembershipBranch e FKs compostas, sem roles ou grants. ADR-011 define filial principal e API mínima local sem auth; as regras de autorização acima continuam obrigatórias antes de exposição pública.

## Concretização na fase 3

ADR-012 registra autenticação/RBAC implementados: banco autoritativo por request, sem cache de sessão/permissões ou bypass global. A exceção local sem auth do ADR-011 terminou. Recuperação de senha e verificação de e-mail estão fora do escopo explícito desta fase.
