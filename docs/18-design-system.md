# Padrão visual do Oss (oficial)

**Status:** aprovado pelo dono do produto em 2026-10-22 (visual do Claude Design: landing e login). **Toda tela nova ou alterada segue este padrão.** Não criar cores, fontes, raios ou estilos de botão fora dos tokens. Referência viva: `apps/admin/styles/tokens.css` (painel) e `apps/mobile/src/ui/theme.ts` (app). Decisão: ADR-027.

## Identidade
- **Marca:** logo Oss (provisória) em `apps/admin/public/brand/oss-site-logo.webp`; sobre fundo escuro usa `mix-blend-mode: lighten` (componente `BrandLogo`). Nunca sobre fundo claro. A "faixa" da marca é branca e preta.
- **Tom:** escuro e sóbrio nas estruturas (menu, topo, apresentação), claro e limpo no conteúdo; destaque em verde-água.

## Temas (ADR-028)
O padrão é o **tema escuro**; o claro continua disponível em Perfil > Aparência (cookie `oss-theme`). Os dois usam os **mesmos nomes de token**; o escuro só os redefine (`:root[data-theme="dark"]` em `tokens.css`): fundo `#08121C`, superfície `#101C2A`, texto `#E8EEF3`, destaque e botão principal `#4CC9B8` (texto `#04201C`), estados com tons próprios (`--danger-text`, `--success-text`…). **Nunca use cor fixa numa tela**: sempre token, para funcionar nos dois temas. O app (Expo) usa `apps/mobile/src/ui/theme.ts` com os mesmos valores.

## Cores (tokens semânticos, valores do tema claro)
| Uso | Token | Valor |
|---|---|---|
| Fundo escuro (menu, topo, hero, login) | `--dark` / `--primary-strong` | `#070E17` |
| Cartão escuro | `--dark-card` | `#0F1A26` (borda `--dark-border`) |
| Texto sobre escuro | `--on-dark` / `--on-dark-muted` | `#E8EEF3` / `#A9B8C6` |
| Botão principal e superfícies de marca | `--primary` | `#14243A` (hover `#1D3352`) |
| Destaque (CTA sobre escuro, ativo) | `--accent-bright` | `#4CC9B8` (texto `#04201C`, hover `#6AD6C7`) |
| Foco, linhas, ícones sobre claro | `--accent` | `#2FA898` |
| Texto de destaque sobre claro | `--accent-strong` | `#1F7F73` |
| Fundo da página | `--bg` | `#F4F6F9` |
| Superfície | `--surface` | `#FFFFFF` (texto `--text` `#0E1A27`, secundário `--text-muted` `#4A5A69`) |
| Bordas | `--border` / `--border-strong` | `#DCE2E8` / `#8A97A8` |
Erro, sucesso, aviso e informação têm tokens próprios e **não mudam** com a cor da academia (`--danger`, `--success`, `--info`).

## Tipografia
Títulos: **Archivo** 700/800 (`--font-heading`, aplicada a `h1–h3`). Texto: **Figtree** 400–700 (`--font-sans`). Servidas pelo próprio site via `next/font` (ADR-026). Escala: `--text-xs … --text-2xl`.

## Forma e espaço
Raios: controles e botões 10px (`--radius-control`), cartões 14px (`--radius-card`), apresentação 24px (`--radius-hero`). Altura de controle 48px (botões grandes 52px). Espaçamento 4/8/12/16/24/32/48 (`--space-*`). Sombras só `--shadow-card` e `--shadow-hero`.

## Componentes (`apps/admin/components/ui`)
`Page`, `PageHeader`, `PageHero`, `Hero`, `Section` (bloco de gestão com título), `Card`, `ItemLink`/`ItemList`, `Button`/`ButtonLink` (primary, secondary, accent), `TextField`, `PasswordField`, `SelectField`, `CheckField`, `Alert`, `Badge`, `Avatar`, `BeltBar`, `ProgressBar`, `ProgressRing`, `WeekStrip`, `Tabs`, `EmptyState`, `AuthShell`, `BrandLogo`. Use-os antes de criar estilo novo; se faltar algo, crie um componente aqui (não CSS solto na tela).

## Regras de tela
1. Estrutura: `AppShell` (menu escuro à esquerda no computador, barra inferior no celular) + `Page` + `PageHeader`/`PageHero`.
2. Telas de gestão: blocos `Section`, listas com `ItemList`/linhas com `Avatar` e `Badge`, ações com `Button`; estados vazios com `EmptyState`; avisos com `Alert`.
3. Botão principal um por bloco; ações por linha são secundárias. Ação de destaque sobre fundo escuro usa `accent`.
4. Celular primeiro: uma coluna, sem rolagem horizontal, alvos de toque de 44px ou mais, foco visível.
5. Acessibilidade: contraste AA, rótulo em todo campo, cor nunca é a única informação.
6. Faixas e medalhas desenhadas são visuais (`beltPaint`); não são regra de graduação.
7. Nada de depoimentos, números de clientes ou preços inventados em telas públicas.

## Telas ainda no visual antigo
Já migradas: landing, login, início/membros/turmas/saúde/painel/financeiro da academia, e as telas do aluno (início, diário, técnicas, graduação, medalhas, desafios, feed, perfil, financeiro, dependentes). As demais páginas de gestão (planos e ficha do aluno no financeiro, currículos, avaliações, graduação, responsáveis, plataforma, turmas/aula, entrar, check-in, formulários de diário e técnica, termos) continuam dentro da "ponte" do shell (herdam cores e fontes dos tokens). Ao tocar numa delas, migre-a para os componentes acima.
