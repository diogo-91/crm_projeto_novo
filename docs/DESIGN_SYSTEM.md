# Design system — fase 4

A fonte dos tokens é packages/ui/src/tokens.css. Primitives seguem padrões shadcn/ui adaptados, com Radix nos comportamentos de overlay/foco. As configurações components.json identificam o pacote compartilhado: não gerar outra cópia dos mesmos componentes na web.

A utilidade cn registra os tamanhos semânticos no tailwind-merge para preservar tamanho e cor juntos (por exemplo, text-caption text-muted), substituindo somente classes realmente conflitantes.

O pacote privado UI exporta fontes React e é transpilado pelo Next; seu build TypeScript independente continua obrigatório. O resolver shadcn aponta ui/components para packages/ui/src e utils para src/utils.ts, nunca dist. Novas primitives exportadas são importáveis por @crm/ui/<nome>; a geração deve ser revisada e necessita acesso ao registro oficial ui.shadcn.com. Adicionar um hook .ts requer export próprio, somente com uso concreto.

| Categoria   | Convenção                                                                         |
| ----------- | --------------------------------------------------------------------------------- |
| Fundos      | background #f7f8fa; surface branco; surface-muted #f0f2f5                         |
| Texto       | foreground #20262e; muted #5d6877                                                 |
| Destaque    | primary #e9b949; primary-foreground #252019; primary-soft #faf0d5                 |
| Sidebar     | sidebar #19212b; foreground #c0c8d2; hover #293441                                |
| Estados     | success, warning, danger, info com texto e superfície semânticos; não somente cor |
| Tipografia  | Geist variável local/Next Font; heading 28px, body 14px, label 13px, caption 12px |
| Espaçamento | escala Tailwind de 4px; container p-5 mobile, p-8 tablet, p-10 desktop            |
| Raios       | sm 6px, md 10px, lg 14px, xl 20px                                                 |
| Sombras     | soft para superfícies; overlay para menus/dialogs                                 |
| Breakpoints | 640, 768, 1024, 1280, 1536px; navegação drawer abaixo de 1024px                   |
| Camadas     | header 20, overlay 40, dialog 50                                                  |
| Movimento   | 150ms; respeitar prefers-reduced-motion                                           |

Button: primary/secondary/outline/ghost/danger/link; sm/md/lg/icon; busy/disabled explícitos. FormField + Label/Input associa rótulos, validação e descrições. Select nativo para opções curtas. Card tem Header/Title/Description/Content/Footer. Badge usa neutral/primary/success/warning/danger/info. Avatar é representação textual da identidade, sem upload antecipado.

Dialog/Sheet e Dropdown/Tooltip têm gerenciamento de foco pelo Radix. Command navega páginas por Cmd/Ctrl+K; não busca dados. Toast tem sucesso/erro/warning/info. Skeleton, EmptyState, ErrorState e Alert tornam estados explícitos. Table é tabela semântica com wrapper de overflow local e TableState; não um DataGrid. Pagination recebe disponibilidade de anterior/próximo para paginação por cursor. Não inventar totalPages que a API não fornece.

PageHeader, AppShell, Sidebar, Topbar, MetricCard e FilterBar pertencem à composição da web. O exemplo de tabela/filtro/paginação/dialog em Configurações é uma demonstração técnica identificada; não contém dados comerciais. MetricCards do Dashboard usam travessão e indicação de disponibilidade futura, não métricas fictícias.

Usar somente tokens semânticos em componentes. Ícones Lucide, nomes acessíveis em ações icon-only, estados com texto, focus visible, skip link, labels/erros ligados por ID. Drawer fecha com Esc e após navegação; o foco retorna ao disparador. Não adicionar primitive, dependência ou variação sem consumidor real.

Publicação e segurança de sessão estão no ADR-013. A preferência local da sidebar é a única persistência no navegador; tokens e dados privados nunca vão para storage. Dark mode e DataGrid não fazem parte da entrega. Os módulos comerciais autorizados na fase 5 reutilizam estes componentes.

## Uso comercial — fase 5

Textarea compartilha tokens e semântica de Input; observações são texto simples. Select associa id, aria-describedby e aria-invalid ao FormField, preserva opção vazia explícita e não duplica placeholder. ErrorState usa Button type=button para retry dentro de formulários.

RecordDialog é composição da web, com conteúdo rolável limitado ao viewport e callbacks oficiais onOpenAutoFocus/onCloseAutoFocus do Radix para capturar/restaurar o foco de formulários abertos programaticamente. Após fechar, prioriza o botão disparador ainda conectado; quando uma atualização remove esse disparador, retorna ao botão principal informado. Não usar delays, queries CSS ou desabilitar o teste de foco.

Clientes/empresas reutilizam Table desktop e cards mobile; overflow de tabela fica local. Tags só usam variantes Badge aprovadas, sem receber estilos CSS do usuário. Listagens, formulários e detalhes têm estados reais de loading, erro, ausência e permissão.
