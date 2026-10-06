# ADR-013 — Design system compartilhado e sessão web coordenada

Status: implementado e validado na fase 4. Data: 2026-10-06.

## Context

A fase 4 autoriza login e navegação reais, layout responsivo e as páginas-base de todas as entradas do menu. Não autoriza módulos comerciais. ADR-008/012 exige access em memória, refresh HttpOnly rotativo e revogação por reuso. Uma implementação de refresh independente em cada componente, efeito React ou aba pode revogar uma sessão legítima. O contexto e os grants pertencem ao backend.

## Decision

Primitives visuais ficam exclusivamente em packages/ui: padrões shadcn/new-york, componentes adaptados e versionados no repositório, Radix para Dialog/Sheet, Dropdown, Tooltip e Slot; cmdk para comando e Sonner para feedback. Não instalar a biblioteca inteira. Select usa o padrão native-select para a lista curta de organizações, com semântica e teclado do navegador. Não precisamos de busca/virtualização/popper nesse seletor. Isso também evita a incompatibilidade de declarações optional/onPlaced do Radix Select com exactOptionalPropertyTypes; nenhuma dependência é patchada e skipLibCheck permanece false. Releases maduras do restante do Radix, React 19 e peers verificados; sem overrides ou supressões. ESM na raiz acompanha os pacotes e permite ao Playwright consumir Prisma sem transformar ESM em CommonJS.

Tokens semânticos Tailwind 4 em packages/ui/src/tokens.css: neutros claros, sidebar escura e dourado moderado; grid de quatro pixels, raios, sombras, tipografia, breakpoints, transições e camadas centralizados. Geist variável é um arquivo local do pacote Fontsource, servido/otimizado por next/font/local, sem download de fontes no build ou em runtime. Sem dark mode adicional. Componentes de layout/navegação ficam na web; não há domínio/HTTP em UI. Componentes de páginas/metadata permanecem Server Components; somente a interação usa Client Components.

UI é um pacote privado React consumido por bundlers: exports apontam a src/index.tsx, src/utils.ts e primitives src/*.tsx; Next já o transpila via transpilePackages. O pacote usa ESNext/moduleResolution=Bundler e imports relativos sem extensão, apropriados a fontes React. O build TypeScript continua emitindo/verificando ESM e declarações independentemente; não se destina à execução direta em Node. Config/contracts/database preservam NodeNext e seus exports compilados. Isso permite que o resolver shadcn encontre o diretório de fonte, em vez de gravar componentes em dist, sem alias de extensão no bundler. Não criar aliases que apontem a artefatos gerados, nem copiar componentes na aplicação. A resolução oficial de components.json é conferida localmente; a CLI de geração precisa de acesso a ui.shadcn.com quando novos componentes forem autorizados. Hooks utilitários .ts futuros exigem export próprio quando houver consumidor, sem diretórios vazios antecipados.

SessionClient é o único proprietário do access token, expiração e snapshot de identidade/contexto na web. Context/useSyncExternalStore expõe estado, não tokens. ApiClient centraliza fetch, credentials=include, no-store, requestId, validação por contracts e erros seguros. Não há tokens em storage, serialização RSC de credenciais, SSR de dados privados, BFF ou autenticação concorrente em Next. Backend continua protegendo toda API.

No carregamento, refresh restaura a sessão; 401 de visitante sem cookie é esperado. AuthProvider compartilha single-flight, inclusive no replay de efeitos Strict Mode. Uma resposta 401 de recurso pode renovar e repetir uma vez; revisão de credencial evita uma nova rotação quando outra request já renovou. Não repetir login/refresh/logout automaticamente, nem renovar em loop. Falha de rede/infraestrutura gera estado visível sem fallback; erro incerto de refresh exige nova entrada, preservando a política estrita de reuso. Logout só é confirmado após a revogação real pelo backend.

Web Locks serializa login, refresh, troca de contexto e logout entre abas da mesma origem; cada operação lê o cookie atual sob lock. BroadcastChannel comunica somente changed/logout, nunca tokens. Cada provider mantém uma única instância para enviar e receber: o emissor não recebe seu próprio evento; uma instância adicional na mesma aba causaria refresh e desmontagem indevidos. Testes com canal nativo protegem essa invariante e a entrega para outras abas. Contexto/identidade diferente cancela requests, descarta credenciais e dados privados anteriores; respostas atrasadas são rejeitadas pela geração. Troca de contexto usa o endpoint existente e aceita somente o snapshot devolvido pelo backend. Revogação também é revalidada em focus/visibility ou na próxima chamada protegida. Exige navegador atual com Web Locks/BroadcastChannel em origem segura (localhost é permitido); ausência gera erro explícito, sem refresh concorrente alternativo. Publicação mantém uma única origem de frontend, conforme ADR-008.

O backend acrescenta context.permissions ao contrato de me/login/refresh/context, calculado dos grants ativos do contexto. Can/usePermission é somente indicação de capacidade para UX. Não agrega scope de outro grant, não autoriza objetos e não deduz permissões pelos nomes dos papéis. A API continua verificando ação+scope do mesmo grant em cada operação.

A filial principal é exibida somente para leitura, a partir do contexto atual do backend. A API não possui seleção de filial nesta etapa; não criar estado ou troca fictícia no cliente.

O layout autenticado protege navegação por estado/redirect. Com access somente em memória, o servidor Next não é uma segunda autoridade de sessão: páginas Server Components nesta fase contêm apenas estrutura pública de placeholders. Futuras páginas privadas não podem buscar/renderizar dados sensíveis no RSC sem uma decisão de caminho seguro para SSR; o caminho atual é o cliente REST autorizado. Não tratar HTTP 200 da estrutura de uma rota como autorização de dados.

As páginas-base de todas as rotas são expressamente solicitadas nesta fase, substituindo o gate anterior do ADR-009/roadmap que evitava gerá-las antecipadamente. Elas compartilham estrutura, sem dados comerciais fictícios. A demonstração de Table/FilterBar/Pagination/Dialog/Toast em Configurações é identificada como técnica, sem gestão de usuários/papéis. Paginação visual segue next/previous com hasNextPage da API de cursor, sem inventar total ou número de páginas.

TanStack Query continua reservado para dados remotos interativos das features futuras: nesta fase duplicaria o proprietário de sessão sem benefício. Não existe cache privado persistido; requests são canceladas na troca. Quando introduzido, seguir keys tenant/membership/scope e limpeza definida no ADR-009.

## Alternatives Considered

- JWT/refresh em localStorage ou cookie legível: viola a decisão de segurança.
- Refresh por componente, efeito ou aba sem coordenação: gera reuso e revogação por concorrência.
- BFF/session cookie Next paralela: cria responsabilidade duplicada sem necessidade nesta fase.
- Permissões por if ADMIN ou por catálogo público: não representa autoridade do ator.
- Radix Select complexo para poucas opções: dependência e comportamento desnecessários; native-select resolve o requisito de forma acessível.
- Forçar releases recentes, desativar exactOptionalPropertyTypes/skipLibCheck ou patchar dependência: descartado.
- DataGrid, state manager, cache remoto e dezenas de primitives sem uso: complexidade sem consumidor.

## Consequences

Há uma única estratégia de sessão, coordenada entre abas, com backend autoritativo e falhas explícitas. Routes/layouts/client boundary são claros; nenhum módulo comercial ou migration adicional. Dependemos dos recursos de navegadores modernos e de uma origem segura. Perda da resposta de rotação pode exigir login novamente, sem relaxar a política de tokens.

Testes Vitest DOM cobrem componentes, estado e cliente HTTP; Playwright cobre API/PG/Redis reais num projeto Compose descartável, contextos A/B, refresh/abas, logout e revogação. Chromium pode ser fornecido por PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, recurso suportado do runner, ou instalado pelo Playwright no CI. Fixtures com credenciais ficam ignoradas, modo 0600, removidas no shutdown; traces e screenshots de falhas ficam desativados para não armazenar senha/cookie. Capturas visuais são feitas somente antes de preencher login ou em páginas sem credenciais. A análise automatizada axe complementa teclado/foco e inspeção visual, não substitui auditoria completa de acessibilidade.
