# ADR-018 — Orçamentos, cálculo exato e revisões imutáveis

Status: aceito. Data: 2026-10-08. Escopo: fase 10 autorizada pelo usuário.

## Context

Catálogo e oportunidades já existem. Orçamentos precisam preservar a proposta apesar de mudanças posteriores de comprador, produto ou preços, aplicar grants tenant e resistir a retries e aprovação concorrente. Não foi solicitado PDF, entrega externa, tributação, integração ERP ou automação.

## Decision

Quotes owns Quote, QuoteItem, QuoteHistory e QuoteRequest. Consulta compradores, catálogo e oportunidades somente pelos gateways públicos dos proprietários. Cada orçamento exige filial, owner membership (criador na criação), um comprador Contact **ou** Company, tabela de preços e 1–100 produtos distintos. Owner e filial não mudam nesta fase. A oportunidade é opcional, mas quando vinculada deve ser legível, ativa, da mesma filial, comprador e moeda. A vinculação não altera seu valor/estado. Snapshots financeiros passam a ser dados do documento, autorizados por quotes.read; consultar os cadastros atuais continua exigindo suas próprias permissões.

Preços vêm exclusivamente da lista selecionada; sem linhas manuais ou override. Snapshots guardam nome/documento/e-mail/telefone do comprador, nome da tabela e descrição/SKU/unidade/preço dos produtos. Endereço não existe no cadastro atual e não será inventado. Quantidade/preço: numeric(18,6); desconto percentual: numeric(5,2), 0–100; valores: numeric(19,4), restritos a centavos. BRL/USD/EUR/GBP usam duas casas. BigInt em unidades escaladas calcula bruto por linha, arredondamento HALF_UP a centavos; desconto HALF_UP sobre bruto arredondado; líquido = bruto − desconto. Totais somam linhas já arredondadas, sem desconto global, câmbio, impostos ou frete. Overflow é rejeitado, não truncado.

Rascunho DRAFT aceita quantidade/desconto, itens, notas e validade. Itens existentes conservam snapshots; acrescentar produto consulta preço ativo atual explicitamente. Não há recálculo automático por alteração do catálogo. APPROVED congela o documento inteiro e seus itens, reforçado por triggers PostgreSQL. Não existe SENT nem botão de envio sem transporte real. Aprovar usa quotes.approve, leitura, escopo e expectedVersion; validade expirada é rejeitada (dia UTC, inclusivo). Não há regra de quatro olhos solicitada: criador com grant de aprovação pode aprovar. Todos os descontos exigem a mesma aprovação, sem limiar ou poder implícito por role.

Revisão de aprovado cria novo UUID DRAFT, rootQuoteId preservado, previousQuoteId e revision crescente. Unique tenant+previous impede ramificação; unique tenant+root+revision reforça a série. O original nunca muda. Revisão copia snapshots, inclusive catálogo arquivado, preserva owner e filial e exige quotes.create/read naquele recurso. Uma revisão aprovada pode gerar a seguinte. Sem exclusão física, versão “sobrescrita” ou status fictício de envio.

Permissões quotes.read/create/update/approve seguem ação+scope do mesmo grant. ADMIN possui todas; DIRECTOR/SALES_MANAGER leem/criam/editam/aprovam; SELLER lê/cria/edita; AFTER_SALES/VIEWER leem. Templates não determinam scope. Seed amplia somente demo e organizações novas, nunca concede privilégios a tenants antigos por migration.

Criação e revisão exigem Idempotency-Key, escopada por tenant+membership+operação e armazenada por SHA-256. Hash de intenção canônica normaliza zeros decimais e campos opcionais; ordem de itens faz parte do documento. QuoteRequest guarda resposta pública e referência ao resultado na mesma transação; falha não deixa IN_PROGRESS órfão. Membership lock serializa o mesmo ator; unique decide qualquer duplicação concorrente. Retry revalida sessão, ação, leitura e scope atuais antes de devolver o resultado. Flags de ação são recalculadas; dados da resposta original permanecem estáveis. Sem TTL automático: reter enquanto documento existir até política de retenção financeira/LGPD, sem expirar a deduplicação arbitrariamente. PATCH/approve usam versão, sem tabela de idempotência desnecessária.

QuoteHistory é trilha específica append-only, ator membership, ação e versão na mesma transação. Não implementa AuditLog universal nem grava PII em logs. Locks: membership → quote → lista → produtos em UUID ordenado. Catálogo e documento nunca fazem chamadas externas dentro da transação. Sem novo outbox/job/evento porque nenhum consumidor existe. PDF/entrega, quando solicitados, precisarão de storage privado, trabalho durável e idempotência própria conforme ADR-007.

Web reutiliza SessionClient, TanStack por tenant/membership/cacheScopeKey, RHF/Zod e UI existente. Totais apresentados são exclusivamente resposta do backend. A chave de criação/revisão é mantida durante retry da mesma intenção; mudar o conteúdo gera outra chave. Nenhum valor/permite é autorizado só no navegador.

## Alternatives Considered

- Float/number ou arredondamento apenas no total: imprecisão e divergência da soma de linhas; rejeitado.
- Atualizar aprovado e apenas incrementar revision: perde documento histórico; novo agregado adotado.
- Adicionar SENT, PDF ou outbox sem entrega real: estados/infraestrutura sem consumidor; rejeitado.
- Copiar regra por nome de papel ou grant amplo de outra ação: viola isolamento; rejeitado.
- Engine fiscal, linhas livres e matriz de alçadas sem requisito: complexidade prematura; política mínima explícita adotada.

## Consequences

Para mudar comprador/lista/filial de uma proposta, criar outro orçamento. Revisão preserva preços anteriores; novo item usa catálogo atual. Valores e descontos máximos estão limitados e validados no servidor/banco. Documentos financeiros têm dados pessoais duplicados intencionalmente; sua retenção/anonimização precisa considerar o contexto legal antes de produção. A aprovação registra decisão interna, não comprova aceitação do cliente ou entrega externa.
