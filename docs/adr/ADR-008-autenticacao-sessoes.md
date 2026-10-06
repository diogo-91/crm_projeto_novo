# ADR-008 — Access token curto e sessões revogáveis

Status: autenticação/sessões implementadas na fase 3; recuperação por e-mail futura, conforme ADR-012. Data: 2026-10-06.

## Context

E-mail/senha precisa coexistir com API REST, web profissional, usuário multiempresa e revogação rápida de acesso. Refresh tokens longos recuperáveis ou access tokens sem sessão dificultam resposta a roubo e desligamento.

## Decision

Senha Argon2id; access token curto e assinado com allowlist de algoritmo/issuer/audience/expiração. Session revogável ligada a User; access inclui sid e exige sessão válida. Cache de sessão/autorização é curto e invalidado nas mudanças, com falha fechada em recursos protegidos.

Refresh opaco aleatório armazenado por hash, com registro por geração, vínculo de predecessor e rotação atômica. Reuso de token consumido revoga família. Cliente single-flight evita corridas; perda de resposta pode exigir relogin, sem janela de reuso genérica. Sessões revogadas em logout/reset/comprometimento e ação autorizada.

Web usa access em memória e refresh em cookie HttpOnly/Secure com SameSite e proteção CSRF/Origin. Sem tokens em localStorage. Mesma origem de publicação via proxy simplifica cookies e CORS. Organização ativa continua validada pelo servidor; claims não substituem membership/grants atuais.

Recuperação via token hash/único/expirável, resposta anti-enumeração e EmailProvider. Troca de senha e revogação são transacionais. Rate limiting e logs sem secrets. SSR só consome sessão por caminho seguro; não serializa tokens.

## Alternatives Considered

- JWT longo sem sessão: menos consultas, mas revogação lenta e grants obsoletos.
- Refresh único sem rotação: reuso roubado permanece válido sem detecção adequada.
- Tokens localStorage: persistência simples, maior exposição a XSS.
- Sessão cookie única: alternativa viável, mas o requisito prevê access/refresh; futuro BFF pode ser avaliado por necessidade, não criado agora.

## Consequences

Revogação e detecção de reuso são claras, com mais estado e coordenação de cache/cliente. Corridas/perda de resposta precisam de UX explícita e testes. O banco de sessões e política de disponibilidade fazem parte do caminho autenticado.

Prazos/parâmetros serão medidos na implementação; 5–15 minutos de access é meta inicial, não SLA validado. Nenhuma autenticação é criada nesta fase.

## Concretização na fase 3

ADR-012 registra autenticação/RBAC implementados: banco autoritativo por request, sem cache de sessão/permissões ou bypass global. A exceção local sem auth do ADR-011 terminou. Recuperação de senha e verificação de e-mail estão fora do escopo explícito desta fase.
