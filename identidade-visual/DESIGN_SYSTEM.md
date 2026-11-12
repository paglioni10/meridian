# Design System · Editorial Suíço

Fonte única de verdade para agentes. Importar `tokens.css`. Nunca definir valores fora dele.

## Princípios
1. Hierarquia por tipografia e filetes, nunca por caixas.
2. Raio 0, sem sombra, sem blur, sem gradiente.
3. Cor é sinal: vermelho = atenção/alerta, azul = ativo/link/foco, preto = tudo o mais.
4. Números grandes, rótulos pequenos em mono maiúsculo.
5. Uma ideia por bloco; sem ícones decorativos, sem emoji.

## Temas
Dois temas em arquivos separados: `theme-light.css` (padrão) e `theme-dark.css`. Ativar com `<html data-theme="light|dark">`; na primeira visita seguir `prefers-color-scheme` e persistir a escolha do usuário. Componentes usam apenas os tokens, nunca HEX. Mesma estrutura nos dois temas: filetes, tipografia e papéis de cor idênticos.

## Tokens de cor · claro
| Token | HEX | Uso |
|---|---|---|
| --paper | #F4F2EC | fundo da aplicação |
| --ink | #111111 | texto, filetes, barras |
| --ink-muted | #5B5B56 | rótulos, texto secundário |
| --rule | #D9D5C9 | filetes suaves, trilhos de progresso |
| --red | #E4002B | alerta, vencimento, offline, erro, ação destrutiva |
| --blue | #1F3FFF | item ativo, em curso, link, foco |
| --on-accent | #FFFFFF | texto sobre vermelho/azul |

## Tokens de cor · escuro
| Token | HEX |
|---|---|
| --paper | #0F0F0E |
| --ink | #F4F2EC |
| --ink-muted | #A3A199 |
| --rule | #2E2D2A |
| --red | #FF5470 |
| --blue | #8A9BFF |
| --on-accent | #0F0F0E |

No escuro, vermelho e azul são mais claros e o texto sobre eles é --on-accent (escuro). Barras de progresso e filetes usam --ink (claro).

Contraste: texto sempre --ink ou --ink-muted sobre --paper. Texto sobre --red/--blue apenas --on-accent. Não criar novas cores nem opacidades.

Valores financeiros: positivo e negativo em --ink, diferenciados por sinal (+ / −). Vermelho só para atraso, vencimento e estouro de orçamento.

## Tipografia
| Papel | Fonte | Peso | Tamanho | Extra |
|---|---|---|---|---|
| Display (saldo) | Archivo | 800 | 56px | tracking -0.03em |
| H1 (data da edição) | Archivo | 800 | 44px | tracking -0.03em |
| Figura | Archivo | 800 | 32px | tracking -0.03em |
| H2 (seção) | Archivo | 800 | 20px | filete inferior 1px |
| Corpo | Public Sans | 400/500 | 14px | line-height 1.5 |
| Dados | IBM Plex Mono | 400/500 | 13px | valores, datas, status, links |
| Rótulo | IBM Plex Mono | 400 | 11px | maiúsculo, --ink-muted |

Valores numéricos sempre em Archivo (figuras) ou IBM Plex Mono (listas). Formato pt-BR: `8.420,15`, datas `09/11`.

## Espaçamento
Escala: 4, 8, 12, 16, 24, 32, 48. Gap entre seções 32px. Padding da página 28px 40px. Sem margens ad hoc; usar flex/grid com gap.

## Filetes
| Token | Valor | Uso |
|---|---|---|
| --rule-heavy | 3px --ink | cabeçalho de página |
| --rule-thin | 1px --ink | topo de stat, H2, cards Kanban |
| --rule-soft | 1px --rule | linhas de lista |

## Layout
- Sidebar fixa 200px, borda direita 1px --ink; índice numerado `01 Visão geral`, item ativo em --red.
- Conteúdo: `.page-head`, linha de stats, depois seções em `.grid-auto` (colunas min 300px).
- Desktop: grade fluida. Mobile (<720px): sidebar vira barra inferior de 6 itens com alvo mínimo 44px; seções empilhadas; stats em 2 colunas.

## Componentes
| Classe | Descrição |
|---|---|
| .page-head | título H1 + metadado mono, filete 3px |
| .stat | rótulo + figura, filete superior; `.alert` troca para vermelho |
| .h2 | título de seção com filete |
| .row | linha de lista: descrição à esquerda, valor mono à direita |
| .progress | trilho 6px; `.active` preenche em azul (meta recente) |
| .tag | status em bloco sólido; `.ink`, `.blue`, padrão vermelho |
| .btn | 44px, borda 1px, mono maiúsculo; `.primary`, `.danger` |
| .input | só filete inferior; foco 3px azul |
| .kanban / .card | 3 colunas A FAZER, EM CURSO, ENTREGUE; card com filete superior, azul quando em curso |

Estados: hover do `.btn` inverte cores; link hover vira vermelho; foco visível sempre em azul.

## Módulos: padrões
- **Finanças:** saldo em `.figure-xl`; CLT e PJ em `.stat` separados; transações em `.row` (data + descrição | valor). Importação OFX/CSV: `.input` de arquivo, prévia em `.row`, `.btn.primary` “Importar”.
- **Objetivos:** lista de `.progress` com nome e percentual mono; sem gráficos decorativos.
- **Freelance:** `.kanban`; valor do projeto em mono no card.
- **Servidores:** `.row` com nome | métrica e status; offline em --red.
- **Cursos:** `.row` título | link `obsidian://` em mono azul.
- **Gráficos:** apenas linhas/barras 1px em --ink, destaque em --blue, alerta em --red; sem preenchimento, sem grade pesada, eixos em mono 11px.

## Acessibilidade
Alvo de toque mínimo 44px. Texto mínimo 11px apenas para rótulos; corpo 14px. Estado nunca só por cor: acompanhar com texto (`OFFLINE`, `A VENCER`).

## PWA
`theme-color` por tema: #F4F2EC (claro) e #0F0F0E (escuro), via meta com `media="(prefers-color-scheme)"`. Ícones: usar exclusivamente os arquivos de `logo/` — `meridian-app-icon.svg` (ícone padrão), `meridian-app-icon-maskable.svg` (ícone maskable do manifest), `meridian-favicon.svg` (favicon), `meridian-symbol*.svg` e `meridian-logo*.svg` (sidebar e tela de login, variante `-light` no tema escuro). Sem arredondar.

## Proibido
Sombras, gradientes, blur, cantos arredondados, cards com fundo, ícones decorativos, emoji, fontes fora das três definidas, cores fora da tabela.

## Next.js + Tailwind
Tailwind v4: o `tailwind.config.js` (formato v3) é carregado via `@config` no `globals.css`, que usa `@import "tailwindcss"`. No app, as classes de componente ficam em `app/styles/components.css` (`@layer components`), combinadas como base + modificador (`btn btn-primary`). Nenhum nome de componente pode coincidir com um utilitário gerado pelo Tailwind: como o config define o espaçamento `nav`, `.bottom-nav` vira `bottom: 64px`; por isso a barra inferior usa `.tabbar` / `.tabbar-item`. Arquivos: `tailwind.config.js`, `globals.css` (camada components), `theme-light.css`, `theme-dark.css`. Fontes via `next/font/google` com variáveis `--font-archivo`, `--font-public-sans`, `--font-plex-mono` no `<html>`. Blur apenas no overlay de modal (`backdrop-blur-overlay`); sombra apenas `shadow-modal` (desktop) e `shadow-sheet` (bottom sheet mobile).

## Breakpoints
| Nome | Largura | Papel |
|---|---|---|
| xs | 360 | celular pequeno |
| sm | 640 | celular grande / landscape |
| md | 768 | tablet |
| lg | 1024 | sidebar fixa aparece, bottom nav some |
| xl | 1280 | desktop |
| 2xl | 1536 | desktop largo |
| 3xl | 1920 | ultrawide Full HD |
| 4xl | 2560 | ultrawide / QHD |

## Grid por faixa
| Faixa | Shell | Stats | Painéis | Kanban |
|---|---|---|---|---|
| <1024 | coluna única, bottom nav 64px | 2 col | 1 col | scroll horizontal com snap |
| 768–1023 | idem | 4 col | 2 col | 3 col |
| 1024–1279 | sidebar 200px + conteúdo | 4 col | 2 col | 3 col |
| 1280–1919 | idem | 4 col | 3 col | 3 col |
| ≥1920 | idem, padding 56px | 4 col | 4 col | 3 col |

Conteúdo limitado a `max-w-content` (1760px) e centralizado; sidebar permanece colada à esquerda em ultrawide. Gap entre seções 24px (<768) e 32px (≥768).

## Regras mobile / PWA
- Bottom nav com 5 destinos (Início, Finanças, Objetivos, Freelance, Mais); servidores e estudos em “Mais”.
- Quick Capture: botão flutuante `capture-fab` acima da bottom nav; modal vira bottom sheet (`items-end`, `shadow-sheet`).
- Alvos ≥44px; inputs com fonte ≥16px no iOS para evitar zoom (`text-[16px]` abaixo de md).
- Respeitar `env(safe-area-inset-*)`; usar `min-h-dvh`.
- Variante `pwa:` para ajustes em modo standalone; `touch:` remove hover.
- Tabelas e listas viram `.row` empilhável; nenhuma rolagem horizontal exceto Kanban.
- Atalho desktop de Quick Capture: `Ctrl/Cmd + K`, exibido com `.kbd`.
