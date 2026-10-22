# Roteiro de demonstração do Oss (alpha, no computador)

Tudo roda **na sua máquina**, com dados **fictícios**. Nada vai para a internet e nenhuma empresa ou dado real entra nesta fase.

## 1. Preparar (uma vez)
1. Docker Desktop ligado. Na raiz do projeto: `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector` (PowerShell: `npx.cmd`).
2. Criar os dados da demonstração: `SUPABASE_ANON_KEY=<chave de npx supabase status> node scripts/seed-demo.mjs` (Windows PowerShell: defina antes `$env:SUPABASE_ANON_KEY="..."`). Ele cria a **Academia Demo (fictícia)** com equipe, 8 alunos, um responsável com menor, turmas, 50 dias de aulas e presenças, graduações de **teste**, trilha, financeiro, feed com fotos geradas, desafio e diário. Se rodar de novo, não duplica.
3. Painel web: `npm run dev -w @dojo/admin` → http://localhost:3000. App do aluno (versão web): `cd apps/mobile && npm run web -- --port 8081` → http://localhost:8081.
4. Conferir tudo antes de apresentar: `node scripts/demo-tour.mjs` (tira prints das telas principais de cada papel e avisa se algo falhar).

## 2. Contas (senha de todas: `demo-senha-123`)
| Papel | E-mail | Para mostrar |
|---|---|---|
| Aluna (Ana) | demo-a1@example.test | ~50 treinos: aparece o aviso de marco, medalhas, graduação com critérios |
| Alunos | demo-a2 … demo-a8@example.test | frequências diferentes (de 80% a 15%) |
| Mestre (gestor) | demo-gestor@example.test | início da equipe, membros, financeiro, saúde, graduação, painel |
| Professores | demo-prof1 / demo-prof2@example.test | aulas, presenças, alunos no número de treinos |
| Responsável | demo-responsavel@example.test | menor Pedro (consentimento verificado), financeiro |
| Super admin | demo-dono@example.test | `/plataforma`: sem acesso a financeiro, saúde, ficha nem feed |

## 3. Roteiro sugerido (cerca de 15 minutos)
1. **Aluno no celular** (Chrome → F12 → modo dispositivo, 390×844, em http://localhost:3000 ou no app em :8081): Início (progresso, semana, próximo treino) → Diário (registrar um treino com técnica) → Técnicas (busca por "armlock") → Evolução (critérios com barra; **recomendação, nunca promoção**) → Medalhas → Feed (reagir e comentar).
2. **Presença validada:** aluno pede check-in na Agenda → entra o **professor** (computador) → Aulas → abre a aula → confirma a presença → volta ao aluno e mostra que só agora conta.
3. **Mestre:** Início da equipe (números e ações rápidas) → Graduação e alunos (quem chegou ao número de treinos; o professor define o seu número) → Financeiro manual (mensalidades, baixa com Pix/dinheiro) → Saúde (dado sensível, leitura auditada) → Menores e responsáveis.
4. **Privacidade:** entrar como super admin e mostrar que ele **não** vê financeiro, saúde nem feed; mostrar que o diário é privado por padrão.
5. **Responsável:** acompanha o filho sem login do menor; vê só as fotos em que o filho aparece.

## 4. O que ainda não existe (avisar antes de perguntarem)
Plano de aula por sessão; logotipo e capa da academia; pagamento online; notificações (push, e-mail, WhatsApp); aula experimental e CRM; despesas e caixa; ficha, termos, financeiro, feed e medalhas dentro do app do celular (hoje só no painel); QR de check-in no app; ícones desenhados na barra de abas do app. Textos de termos e consentimentos estão em **rascunho jurídico**; graduações e limiares são valores de **teste**.

## 5. Se algo sair do esperado
- Tela sem dados: o seed não rodou (passo 2) ou o Supabase está parado (passo 1).
- "Link venceu" na recuperação de senha: abra o link no **mesmo navegador** em que pediu e use `localhost`.
- E-mails de teste aparecem no Mailpit: http://127.0.0.1:54324.
- Para voltar a um banco limpo (apaga TUDO que é local): `npx supabase db reset` e rode o seed de novo.
