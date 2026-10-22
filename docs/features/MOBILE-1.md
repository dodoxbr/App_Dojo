# MOBILE-1 — App do aluno (Expo), primeira entrega

**Pronto quando:** o aluno entra no app, vê o início com o seu progresso, registra e consulta o diário privado com técnicas, busca no catálogo, acompanha a evolução de graduação e pede check-in nas aulas, tudo com a mesma segurança do painel (RLS), sem lógica de negócio no cliente.
**Fontes:** `DOJO_UI_UX_BRIEF_CLAUDE.md` (seções 3 a 5, navegação mobile: Início, Diário, Técnicas, Evolução, Perfil), `CLAUDE.md` regras 3, 5, 6, 7 e 8, ADR-010 (token em armazenamento seguro), ADR-024 (tokens do Design System).

## Regras
1. **Só leitura e escrita pelas operações do banco** (mesmas RPCs do painel: `save_training_log`, `search_techniques`, `evaluate_promotion`, `request_check_in`); o app nunca envia `academy_id`, papel ou `user_id` como autoridade (a RLS decide). Sem `service_role` (só a chave pública).
2. **Diário privado e idempotente:** cada registro leva uma chave única (`client_key`); repetir o envio não duplica. Registrar treino **não** é presença.
3. **Check-in** cria um pedido **pendente**; só o professor valida (regra 8). A tela mostra "aguardando confirmação".
4. **Graduação:** somente leitura e como recomendação; o aluno não altera nada (regra 7). Sem regra cadastrada, o app mostra um aviso, nunca um número inventado.
5. Dados de menores e de outros papéis não aparecem: o app é do aluno adulto (menores nunca têm login; o responsável usa o painel por enquanto).
6. Textos em português do Brasil; tokens e componentes iguais aos do painel (`src/ui`).

## Telas e arquivos
`src/app/login.tsx`, `src/app/(tabs)/{index,diario,tecnicas,evolucao,perfil}.tsx`, `src/app/diario/{novo,[id]}.tsx`, `src/app/tecnica/[id].tsx`, `src/app/aulas.tsx`, `src/ui/{theme.ts,index.tsx}`, `src/lib/{queries,hooks,session,supabase}.ts`. Semana local (segunda a domingo) em `packages/contracts/src/week.ts`, compartilhada com o painel.

## Riscos
Dependência de rede (sem modo offline), ícones da barra de abas são símbolos de texto (sem biblioteca de ícones, que exigiria ADR), datas digitadas como AAAA-MM-DD (sem seletor nativo), versão testada em navegador e não em aparelho/emulador.

## Testes
`npm run lint` e `npm run typecheck` (CI); `scripts/e2e-mobile-web.mjs` (Chrome real, 390 px, contra o Supabase local: erro de login, início, registrar treino com técnica, diário, busca, evolução, check-in pendente, perfil, sair, cadastro com senha diferente); contratos (semana).

## Fora de escopo
Ficha, termos, financeiro, feed, desafios, medalhas, aviso de treinos, recuperar senha dentro do app, QR de check-in, notificações, modo offline, funções de gestor e professor, responsável de menores.
