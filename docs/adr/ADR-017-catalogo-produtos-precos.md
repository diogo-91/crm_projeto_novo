# ADR-017 — Catálogo organizacional e tabelas de preços

Status: aceito. Data: 2026-10-08. Escopo: fase 9 autorizada após o usuário adiar a instalação da Evolution para sua VPS. A fase 8 tem somente ambiente local preparado; a integração CRM permanece pendente. Catálogo não depende de messaging.

## Context

Produtos e preços servirão futuros orçamentos. O catálogo não tem carteira comercial; listas podem atender toda a organização ou uma filial. A política precisa ser explícita para grants OWN e campos NULL. Não há requisito de estoque, ERP, importação ou documentos comerciais nesta etapa.

## Decision

Catalog owns Product, PriceList e PriceListItem. SKU obrigatório, trim/uppercase, ASCII alfanumérico com ponto/hífen/underscore, unique por tenant inclusive arquivados. Unidade é texto escolhido na criação e imutável pela API; mudar unidade exige novo produto, evitando reinterpretar preços vigentes. Nenhum estoque ou enum fiscal. Nome de lista normalizado tem unique por tenant inclusive arquivadas. FKs compostas protegem lista/produto/filial/autores da mesma organização. Exclusões são arquivamento, sem mudar tenant nem apagar referências.

products.read permite leitura do catálogo compartilhado a um grant válido; products.manage exige ORGANIZATION. price-lists.read permite listas organizacionais e listas das filiais do grant intersectadas com os vínculos atuais. OWN lê listas organizacionais e das próprias filiais; não administra. price-lists.manage exige ORGANIZATION para lista organizacional ou escopo BRANCH/BRANCH_SET/ORGANIZATION que cubra a filial. Cada decisão usa sua própria ação, sem empréstimo de scope. Leitura de itens também exige products.read.

ADMIN recebe todas as ações; DIRECTOR recebe leitura e gestão de catálogo/preços; SALES_MANAGER recebe leitura e gestão de preços conforme seu scope; SELLER/AFTER_SALES/VIEWER recebem leitura. Templates não definem scope. Seed atualiza apenas demo e novos tenants; migration não concede privilégios globais.

Preço unitário é numeric(18,6), até 12 dígitos inteiros e seis fracionários, não negativo, string decimal em REST. Moedas suportadas BRL/USD/EUR/GBP, compartilhadas com oportunidades; sem câmbio, floats ou arredondamento implícito de entrada. Moeda e filial de uma lista são imutáveis: criar outra lista para mudar contexto. Fase de orçamentos definirá arredondamento de liquidação e snapshots; mudar preço/produto nunca será instrução para recalcular documento emitido.

PATCH/DELETE usam expectedVersion. Itens pertencem ao agregado PriceList: PUT de preço cria/atualiza/reativa explicitamente o único item produto/lista; DELETE desativa o item. Todas essas operações travam e incrementam a versão da lista. Revalidar sessão/grants sob lock e conferir produto ativo sob lock antes do preço; lock de produto no arquivamento impede corrida. Produto/lista arquivados não aceitam alterações; preços e referências anteriores permanecem legíveis. Concorrência de SKU/nome usa uniques, gerando 409 seguro. Listas e itens paginados no SQL; detalhe não carrega itens ilimitados.

Controllers e services seguem o padrão existente, Prisma em repository de infrastructure. Nenhuma interface de ERP, outbox, fila ou gateway especulativo. Web usa SessionClient/TanStack/RHF/Zod/tokens existentes e keys isoladas por membership/tenant/cacheScopeKey; backend autoriza. Logs registram apenas IDs/eventos.

## Alternatives Considered

- Produto preso à filial/carteira: duplica catálogo e impede reutilização; rejeitado.
- NULL como scope irrestrito de administração: viola grants; política explícita adotada.
- Float ou reutilizar limite de quatro casas do valor total para preço unitário: diverge da precisão prevista; numeric(18,6) adotado.
- Alterar unidade de produto ou moeda/filial de uma lista existente: reinterpreta valores ou amplia visibilidade; rejeitado.
- Histórico temporal de preço, estoque, ERP/importação/outbox sem consumidor: complexidade antecipada; rejeitado.

## Consequences

Uma alteração concorrente exige recarregar a lista antes de salvar. Catálogo e preços arquivados mantêm chaves/referências e podem ser consultados com filtros explícitos. Busca substring segue limitada e paginada; medir antes de trigram. PostgreSQL continua autoridade da integridade. Orçamentos, messaging e integração ERP não foram implementados.
