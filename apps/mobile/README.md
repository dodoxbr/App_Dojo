# Dojo Platform — app mobile (Expo)

App do **aluno** (Expo Router, React Native). Usa o mesmo banco e as mesmas regras do painel web: toda leitura e escrita passa pelo Supabase com a sessão da pessoa e a RLS decide o que ela vê. O app só mostra; nunca confia no que o cliente diz sobre papel ou academia.

## Telas (v1)
Entrar / Criar conta · **Início** (progresso, semana, próximo treino, diário recente) · **Diário** (lista, registrar treino com técnicas, detalhe, excluir) · **Técnicas** (busca e detalhe) · **Evolução** (critérios e histórico de graduação) · **Perfil** · **Agenda de aulas** com pedido de check-in (só vira presença quando o professor confirma).

Ainda só no painel web: ficha de cadastro, termos, financeiro, feed de fotos, desafios, medalhas, aviso de treinos, recuperar senha (o link do e-mail abre no painel) e tudo de gestor e professor.

## Como rodar
1. `cp .env.example .env` e preencha `EXPO_PUBLIC_SUPABASE_ANON_KEY` (rode `npx supabase status` na raiz). **Nunca** use a `service_role` aqui.
   - Emulador Android: `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321` (o emulador enxerga o seu computador como `10.0.2.2`).
   - Navegador ou iOS no mesmo computador: `http://127.0.0.1:54321`.
   - Celular de verdade: o IP do computador na rede (ex.: `http://192.168.0.10:54321`).
2. Na raiz: `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector`.
3. Aqui: `npm run android` (emulador do Android Studio aberto), `npm run web` (navegador) ou `npm start` e escolha.
4. No Windows/PowerShell, use `npm.cmd` e `npx.cmd` se a execução de scripts estiver bloqueada.

## Testes
`npm run lint` e `npm run typecheck` (rodam no CI). Passeio automático em Chrome (versão web do app, contra o Supabase local): com `npm run web -- --port 8081` ligado, na raiz `node scripts/e2e-mobile-web.mjs`.

## Estrutura
`src/app` (rotas) · `src/ui` (tema e componentes do Design System: tokens iguais aos do painel) · `src/lib` (Supabase, sessão, consultas).
