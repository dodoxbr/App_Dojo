# Auditoria técnica e status do projeto — Dojo Platform

**Data da auditoria:** 2026-10-21 (horário de Brasília, ~09:30). **Commit auditado:** `c057b8f` (branch `main`, igual a `origin/main`).
**Escopo:** somente leitura e execução de comandos não destrutivos. Nenhum código, configuração, dependência ou dado foi alterado; o único arquivo criado é este relatório. Nenhum conteúdo de `.env` ou chave foi lido para o relatório.
**Base das afirmações:** arquivos do repositório, comandos executados nesta sessão (seção 4) e consultas somente leitura ao banco local e à API pública do GitHub. Onde algo é inferência, está dito.

> Legenda de estado: **IMPLEMENTADO** (existe e foi exercitado por teste automatizado), **PARCIAL**, **NÃO INICIADO**, **NÃO VERIFICADO**.
> "Testado" aqui significa: existe teste automatizado que passou nesta auditoria ou em CI verde anterior. Código sem teste é dito como "só implementado".

---

## 1. Inventário do projeto

### 1.1 Estrutura (monorepo npm workspaces)
| Caminho | Conteúdo |
|---|---|
| `apps/admin` | Painel web Next.js (56 rotas `page.tsx`/`route.ts`), servidor + cliente |
| `apps/mobile` | App Expo/React Native (6 arquivos em `src/`: login, perfil, sessão, storage seguro) |
| `packages/contracts` | Esquemas Zod e regras puras compartilhadas (TypeScript exportado direto, sem build) |
| `packages/domain` | Função pura de progresso de graduação (`src/progress.mjs`) |
| `supabase/migrations` | 31 migrações SQL (~6.750 linhas) |
| `supabase/tests/database` | 26 arquivos pgTAP (1.105 asserções planejadas, ~2.980 linhas) |
| `scripts/` | Smoke tests por módulo, `e2e-pilot.mjs`, `smoke-pages.mjs`, `e2e-browser.mjs`, `e2e-login.mjs`, utilitários locais |
| `docs/` | PRD, arquitetura, regras, segurança, backlog, pendências, ADRs (001–024), 20 fichas de história em `docs/features/` |
| `data/catalog`, `references/` | Origem do catálogo de técnicas (planilha de referência + extrator Python) |
| `.github/workflows/ci.yml` | Pipeline: qualidade, banco, segredos, catálogo |

### 1.2 Linguagens e versões (de `package.json` e `package-lock.json`)
- Node `>=24` (executando v24.19.0), npm 11.17.0, Supabase CLI 2.121.0 (devDependency do raiz), Python 3 (só para o catálogo).
- **Admin:** Next 16.4.2 (Turbopack), React 19.3.0, `@supabase/supabase-js` ^2.118.0, `@supabase/ssr` ^0.12.7, `sharp` ^0.35.5 (fotos), `qrcode` ^1.5.4, TypeScript ^5, ESLint ^9 com `eslint-config-next` 16.4.2.
- **Mobile:** Expo ~58.0.16, React Native 0.88.0, `expo-router` ~58.0.24, `expo-secure-store` ~58.0.2, TypeScript ~6.0.3, `react-native-web` ~0.21.4.
- **Contratos:** Zod 4.6.7 (ver achado M-01: dependência não declarada).
- **Banco:** PostgreSQL via Supabase local, extensões `pgTAP` e `pg_cron` (jobs `auto-charges` 09:00 UTC e `purge-feed` 09:30 UTC confirmados em `cron.job` no banco local).

### 1.3 Aplicações
- **Web (admin):** completa em funcionalidades; é a interface funcional do produto hoje.
- **Mobile (Expo):** esqueleto. Telas: login/cadastro (`apps/mobile/src/app/login.tsx`) e "Meu perfil" com edição do nome (`apps/mobile/src/app/index.tsx`). Nenhuma das telas de negócio existe.
- **Backend:** não há servidor próprio, por decisão (ADR-001). Toda regra crítica é função SQL `security definer` com `set search_path = ''`; o Next faz apenas orquestração (server actions e duas rotas de API do feed).

### 1.4 Supabase, autenticação, banco e storage
- `supabase/config.toml`: `project_id = "dojo-platform-local"`, `minimum_password_length = 8`, `enable_confirmations = true`. **Não há seção `[auth.rate_limit]`** (usa os padrões da CLI); limites para produção não estão definidos no repositório.
- Autenticação: e-mail e senha com confirmação (Supabase Auth). Sessão no admin por cookies (`@supabase/ssr`, `apps/admin/proxy.ts`); no mobile por `expo-secure-store`. **Não há login social e não há recuperação de senha** (nenhum uso de `resetPasswordForEmail` no código).
- Banco: 44 tabelas, todas com RLS habilitada (script de auditoria sobre as migrações: 44 de 44). 52 políticas. 11 tabelas têm RLS e nenhuma política de propósito (acesso só por função): `charge_events`, `check_in_tokens`, `feed_comment_reports`, `feed_comments`, `feed_post_tags`, `feed_reactions`, `feed_reports`, `guardian_invites`, `milestone_settings`, `platform_admins`, `technique_views`.
- Funções: 192 definições em `public` (inclui `create or replace`); **nenhuma `security definer` sem `set search_path`**. Único `grant ... to anon`: `public_academy_legal(text)` (`202610200024_academy_legal_and_emergency.sql`), usado na página pública de termos da academia.
- **Storage:** o Supabase Storage **não é usado**. Fotos do feed ficam em coluna `bytea` (`202610200027_feed.sql:21`, até 800 KB) por decisão registrada (ADR-022). Isso diverge do desenho original em `docs/02-arquitetura.md` (buckets privados) — ver seção 6.
- `service_role`: nenhuma ocorrência em código executável (`apps/`, `packages/`, `scripts/`); só comentários que proíbem o uso (`apps/admin/lib/supabase/env.ts:1`, `apps/mobile/src/lib/supabase.ts:5`).

### 1.5 Scripts disponíveis
Raiz: `lint`, `typecheck`, `test`, `check` (os três), `db:start`, `db:reset`, `db:test`, `db:stop`, `catalog:build`. Admin: `dev`, `build`, `lint`, `test` (`node --test lib/*.test.ts`). Mobile: `start`, `android`, `ios`, `web`, `lint`, `typecheck`. Contratos: `test`, `typecheck`. Utilitários em `scripts/`: `make-platform-admin.mjs`, `set-admin-diary-access.mjs`, `prelaunch-check.sql`, `e2e-browser.mjs`, `e2e-login.mjs`.

### 1.6 Estado do Git
Branch `main`, 36 commits, sincronizada com `origin/main`. Alterações não commitadas: `telaapp1.jpeg` e `telaref2.jpeg` apagados (haviam sido commitados) e dois arquivos novos não rastreados (`dashALuno.jpeg`, `perfil_e_evoluvao.jpeg`) — imagens de referência de UX. O repositório é **público**; quatro imagens de referência (`plantreino.jpeg`, `telaAdmin.jpeg`, `telaapp1.jpeg`, `telaref2.jpeg`) já estão no histórico. `.gitignore` cobre `.env`, `.env.*` (exceto `.env.example`), `.idea/`, `.vscode/`, `tmp-shots/`. Há um `apps/admin/.env.local` local, ignorado pelo git (conteúdo não lido).

---

## 2. Funcionalidades implementadas

**Resumo:** 16 módulos analisados — 12 IMPLEMENTADO (2.1 só na web; 2.2, 2.4, 2.5, 2.6, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.16) e 4 PARCIAL (2.3, 2.7, 2.14, 2.15); dentro deles, plano de aula (2.7) e vídeo (2.14) estão NÃO INICIADOS e o app mobile (2.1/2.15) é só esqueleto. Nenhum módulo ficou NÃO VERIFICADO quanto à existência; a validação em mobile e em hospedagem é que não foi feita. Detalhe abaixo. "Camadas de teste" usadas: **pgTAP** (banco, `supabase/tests/database`), **smoke** (`scripts/smoke-*.mjs`, API real contra o banco local), **páginas** (`scripts/smoke-pages.mjs`, 93 telas/rotas renderizadas por papel), **navegador** (`scripts/e2e-browser.mjs` e `e2e-login.mjs`, Chrome real em tamanho de celular), **contratos** (`packages/contracts/tests`, 83 testes).

### 2.1 Cadastro e autenticação — IMPLEMENTADO (web), PARCIAL (mobile)
- **Funciona:** cadastro com confirmação por e-mail, login, sair, perfil global, aceite de termos na criação (`terms_version` no metadado), conta de menor criada pelo responsável (ADR-018, sem e-mail/senha), recuperação de ficha. Redesign de login/cadastro em abas, mostrar/ocultar senha, confirmação de senha, valores mantidos após erro.
- **Incompleto:** **não há recuperação de senha** (exigida em `docs/06` "Gates antes do piloto: recuperação de conta" e pedida no brief de UI). Sem login social (não previsto). Mobile só tem login/cadastro e edição do nome.
- **Arquivos:** `apps/admin/app/login/{page.tsx,login-forms.tsx,actions.ts}`, `apps/admin/proxy.ts`, `apps/admin/lib/context.ts`, `supabase/migrations/202610200003_profile_on_signup.sql`, `...019_age_gate.sql`, `...023_terms_and_contacts.sql`, `packages/contracts/src/auth.ts`, `apps/mobile/src/app/login.tsx`.
- **Testes:** pgTAP `profiles` (12), `age_gate` (28); `smoke-auth.mjs`; `e2e-login.mjs` (navegador: 4 tamanhos, abas por clique e teclado, erro de login, cadastro real, confirmação pelo Mailpit, entrada); contratos `auth`. Mobile: só lint e typecheck (sem teste de execução).

### 2.2 Cadastro de academias — IMPLEMENTADO
- **Funciona:** só contas liberadas pelo super admin criam academia (`academy_creators`); o criador vira gestor por operação segura; dados da empresa (razão social, CNPJ validado) por academia; convite/endereço `/entrar/[slug]`.
- **Arquivos:** `...004_academy_creation.sql`, `...024_academy_legal_and_emergency.sql`, `apps/admin/app/academias/nova`, `apps/admin/app/academia/[id]/page.tsx`, `plataforma/page.tsx`.
- **Testes:** pgTAP `academy_creation` (45), `academy_legal` (24); `smoke-academy.mjs`; páginas.

### 2.3 Identidade visual personalizada por academia — PARCIAL
- **Funciona:** cores primária/secundária validadas por contraste WCAG ≥ 4,5:1 no banco (`contrast_ratio` em `...004:85`, verificação em `...004:187`); aplicadas na página de entrada da academia (`apps/admin/app/entrar/[slug]/page.tsx`) e editáveis em `apps/admin/app/academia/[id]/settings-form.tsx`.
- **Incompleto:** a coluna `logo_path` existe (`...001_initial.sql:17`) mas **não há upload nem exibição de logotipo**, nem imagem de capa (nenhuma ocorrência de capa/cover no banco ou no painel). O tema da academia **não** é aplicado nas telas internas (só no convite); `AcademyThemeProvider` do brief não existe. Cada academia mudando só duas cores.
- **Testes:** pgTAP de contraste dentro de `academy_creation`; páginas.

### 2.4 Filiação e aprovação — IMPLEMENTADO
- **Funciona:** pedido (`request_membership`, `...005_membership_flow.sql:15`), decisão com idempotência e auditoria (`decide_membership`, `...005:45`, reescrita em `...021` para exigir consentimento de menor), estados pendente/aprovada/rejeitada/suspensa; só `approved` libera recursos internos.
- **Testes:** pgTAP `membership_flow` (42), `rls_baseline` (14), `idempotency_strict` (4); `smoke-membership.mjs`; `e2e-pilot.mjs`.

### 2.5 Perfis e permissões — IMPLEMENTADO
- **Funciona:** papéis por academia (`student`, `instructor`, `manager`); permissões granulares do instrutor (`academy_role_permissions`, `...004:31`; `set_instructor_permission`, `...026`: `view_roster`, `validate_attendance`, `recommend_graduation`, `assess_skills`, `view_progress`, `view_health`); super admin separado (`platform_admins`), sem acesso a financeiro, saúde, ficha e feed.
- **Testes:** pgTAP em quase todos os arquivos (negativos entre academias e papéis); páginas validam redirecionamento por papel.

### 2.6 Turmas e horários — IMPLEMENTADO
- **Funciona:** criar turma com instrutor responsável e agendar/cancelar sessões (`create_session`, `...011_classes_sessions.sql:131`); agenda `/aulas`.
- **Testes:** pgTAP `classes_sessions` (41); `smoke-classes.mjs`; páginas.

### 2.7 Aulas e planos de treino — PARCIAL (sessões) / NÃO INICIADO (plano de aula)
- **Funciona:** sessões datadas por turma.
- **Não existe:** **plano de aula** (técnicas planejadas por sessão). Nenhuma tabela ou tela para isso (busca por `lesson_plan`, `session_techniques`, "plano de aula" nas migrações e no painel: sem resultados; "Plano de Treino" aparece apenas como nome da planilha de origem do catálogo). Existe a imagem de referência `plantreino.jpeg`, ainda sem história no backlog.

### 2.8 Check-in e validação de presença — IMPLEMENTADO
- **Funciona:** pedido pelo aluno (manual ou QR com token efêmero guardado só como hash), validação/revogação com justificativa pelo professor ou gestor (`request_check_in` `...012:117`, `validate_attendance` `...012:159`), uma presença por aluno/sessão, só `validated` conta (regra 8); log de treino não vira presença.
- **Testes:** pgTAP `attendance` (65), `idempotency_strict`; `smoke-attendance.mjs`; `e2e-pilot.mjs`; páginas (`QrBlock` renderizado).

### 2.9 Catálogo de técnicas — IMPLEMENTADO
- **Funciona:** 131 técnicas globais (consulta ao banco local) importadas da planilha de referência, mais técnicas por academia, busca por nome/sinônimo, classificação, correções (`...006`–`...009`).
- **Atenção:** o conteúdo é o da planilha fornecida; revisão técnica por professor está registrada como pendência em `docs/11`.
- **Testes:** pgTAP `technique_catalog` (64); `smoke-catalog.mjs`; CI regera o seed e compara (`git diff --exit-code`).

### 2.10 Diário de treinos — IMPLEMENTADO
- **Funciona:** registro privado com técnicas associadas (N:N), sem acesso do gestor/professor; offline-safe por `client_key`.
- **Ressalva de privacidade (aberta):** `platform_settings.admin_diary_access` tem **default `true`** (`...010_training_diary.sql:18`, uso em `:29`): na fase de teste o super admin lê diários em `/plataforma/diarios`. Deve ser desligado antes de uso real (`scripts/set-admin-diary-access.mjs`); está registrado em `docs/11` e no verificador `scripts/prelaunch-check.sql`.
- **Testes:** pgTAP `training_diary` (36); `smoke-diary.mjs`; páginas.

### 2.11 Trilhas de aprendizagem — IMPLEMENTADO
- **Funciona:** currículos por nível, itens com técnicas, estados `not_started → studied → practicing → validated` com `validated` só por professor (`...013_curriculum_skills.sql`); telas `/trilha` (aluno), `/academia/[id]/curriculos`, `/avaliacoes`.
- **Testes:** pgTAP `curriculum_skills` (63); `smoke-curriculum.mjs`; páginas.

### 2.12 Regras e acompanhamento de graduação — IMPLEMENTADO
- **Funciona:** regras versionadas e imutáveis (`...014_promotion_rules.sql`), cálculo de progresso só com presença validada, concessão e retificação atômicas, idempotentes e auditadas (`grant_promotion`, `...016:136`), graduação atual por view (`current_ranks`, `...016:14`), aluno não altera graduação oficial, ninguém se autopromove (`...017`). Extra: aviso dos 30 treinos por professor (US-020, `...030`/`...031`).
- **Atenção:** nenhum número de graduação é inventado; faixas de exemplo no teste são rotuladas "Faixa Teste A". Critérios de idade/kids/federação aguardam definição do dono do produto (`docs/14`).
- **Testes:** pgTAP `promotion_rules` (65), `grant_promotion` (61), `milestone` (39); `smoke-graduation.mjs`, `smoke-promotion.mjs`; contratos; `packages/domain` (4 testes).

### 2.13 Painel administrativo — IMPLEMENTADO (funcional, visual antigo)
- **Funciona:** membros e pedidos, responsáveis e consentimento de menores, saúde, financeiro, turmas, currículos, avaliações, graduação, painel de frequência/retenção (`academy_dashboard`, `...018`), plataforma (super admin).
- **Incompleto:** o visual ainda é o protótipo (camada `legacy`); não há AppShell/sidebar/topbar conforme o brief; "graduações elegíveis" no painel é a lista de alunos, sem indicador agregado dedicado.
- **Testes:** pgTAP `dashboard` (45); páginas (93).

### 2.14 Upload de fotos e vídeos — PARCIAL
- **Fotos:** IMPLEMENTADO (feed). Processamento no servidor com `sharp` (remove EXIF/GPS, gira, reduz a 1600 px, regrava JPEG; `apps/admin/lib/feed-image.ts`), rota `POST /api/feed/upload` com barreira de origem cruzada (`sec-fetch-site`, `route.ts:12-14`), limites (8 MB bruto, 800 KB final, 20 posts/dia), foto de menor só com consentimento, retenção de 30 dias com apagamento real (`purge-feed`).
- **Vídeo:** **NÃO INICIADO** (nenhuma ocorrência em código; fora de escopo declarado). **Foto de perfil e logotipo:** não existem.
- **Testes:** pgTAP `feed` (52), `feed_guardian` (23); teste de unidade da limpeza de metadados (`apps/admin/lib/feed-image.test.ts`, 5); `smoke-pages.mjs` faz envio real e inspeciona o JPEG salvo.

### 2.15 Interface responsiva e experiência mobile — PARCIAL
- **Web:** layout fluido; login/cadastro redesenhados e testados em 360/390/768/1280 px sem rolagem horizontal; demais telas funcionais em celular (passeio em Chrome móvel sem achados), mas com visual antigo.
- **App mobile:** só login e perfil (ver 2.1). Nenhuma das telas de aluno do brief existe no app.

### 2.16 Funcionalidades sociais e financeiras — IMPLEMENTADO (financeiro manual e feed), NÃO INICIADO (pagamento online)
- **Social:** feed de fotos (US-018), reações "Oss!", comentários moderados e medalhas calculadas (US-019), desafios entre alunos (US-014), responsável acompanha o filho.
- **Financeiro:** só **controle manual** em centavos (planos, mensalidades automáticas por `pg_cron`, desconto, cobrança avulsa, baixa manual, histórico imutável, `view_health` separado). **Sem gateway de pagamento** (decisão: fica para depois da validação).
- **Testes:** pgTAP `feed*`, `challenges` (82), `medals` (27), `finance` (69), `finance_extras` (22), `guardians` (68), `contacts` (45), `health_access` (21); `smoke-challenges`, `smoke-guardians`, `smoke-finance`.

---

## 3. Arquitetura e banco de dados

### 3.1 Modelo e migrações
31 migrações cronológicas (`202610200001` a `...031`), cada uma ligada a uma história (`docs/features/US-0xx.md`). O modelo lógico de `docs/03` (profiles, academies, memberships, classes, sessions, attendances, training_logs, promotion_rules, promotions, curricula) está implementado; foram acrescentados desafios, responsáveis/consentimentos, ficha de contato, financeiro, feed, medalhas e marcos, todos documentados em ADRs 018–024.

### 3.2 RLS e isolamento multi-tenant
- 100% das tabelas com RLS e nenhuma tabela sem controle (verificação automática sobre `create table` × `enable row level security`).
- O isolamento por academia é por `academy_id` + políticas/funções com `is_academy_member`, `is_approved_member`, `is_academy_manager`; o cliente nunca informa papel ou academia em operações críticas (regra 3 do contrato).
- Testes negativos entre academias existem nos pgTAP de cada módulo (ex.: "outra academia não vê", "super admin não vê").

### 3.3 Integridade de presenças e graduações
- Presença: restrição única `(session_id, user_id)`; check de estado consistente (`attendances_state_chk`, `...012`); FK composta garante sessão da mesma academia.
- Graduação: `promotions` e `manual_assessments` e `charge_events` são imutáveis por trigger `prevent_mutation` (confirmado em `pg_trigger`); correção apenas por evento novo; idempotência por chave em `audit_events` (`...015_strict_idempotency.sql`).

### 3.4 Segurança de uploads e dados pessoais
- Upload: ver 2.14. Dados pessoais da ficha em `profile_contacts` com leitura auditada pelo gestor (ADR-019); saúde só com consentimento e permissão (`can_view_health`), leitura auditada sem guardar o texto.
- Menores: nunca têm login; responsável legal verificado pelo gestor (documento conferido), limite de 7 dependentes, consentimento revogável que oculta fotos na hora.

### 3.5 Tratamento de erros
Códigos padronizados nas funções (`28000`, `42501`, `P0002`, `23505`, `22023`) mapeados para mensagens sem vazar dados de outras academias (`apps/admin/lib/rpc-errors.ts`); páginas de recurso inexistente e de não-membro respondem igual (404), evitando enumeração.

### 3.6 Aderência à arquitetura prevista
Aderente a Supabase + Postgres + Next + Expo, sem microsserviços (ADR-001). Desvios documentados: foto no banco em vez de Storage (ADR-022); `pg_cron` para tarefas agendadas (ADR-021); `sharp` no servidor (ADR-022). `docs/02-arquitetura.md` não foi atualizado para refletir o desvio de Storage (ver divergências).

### 3.7 Problemas concretos encontrados (com evidência)
Resumidos aqui e classificados na seção 7: CI vermelho (A-01), `zod` não declarado (M-01), testes de banco dependentes de horário e do estado do banco (A-01, M-02), `audit_events` sem trava de imutabilidade (M-03), rota `/medalhas` fora da lista do `proxy.ts` (B-01), padrão de `admin_diary_access` (documentado, ver 2.10).

---

## 4. Qualidade e testes (comandos executados nesta auditoria)

| Comando | Resultado |
|---|---|
| `npm run lint` (domain, admin, mobile) | passou, sem avisos |
| `npm run typecheck` (contracts, admin, mobile) | passou, sem erros |
| `npm test` | contratos **83/83**, domain **4/4**, admin **5/5** |
| `npm run build -w @dojo/admin` | compilou com sucesso (com URL e chave fictícias de ambiente) |
| `npx supabase test db` (pgTAP, transacional, não destrutivo) | **FALHOU em 7 testes (5 por dados de sobra no banco local e 2 por horário); 1.070 asserções executadas de 1.105 planejadas** (ver abaixo) |
| `scripts/e2e-login.mjs` e `scripts/e2e-browser.mjs` (rodados mais cedo na sessão) | 0 achados |
| `scripts/smoke-pages.mjs` (rodado mais cedo na sessão) | 93 telas verificadas, OK |

**Falhas do pgTAP e causa:**
- **Banco local não está limpo:** contém 7 usuários, 1 academia e 2 cobranças criados em testes manuais (consulta somente leitura). Cinco testes contam registros **globais** (`audit_events`, mensalidades, comentários) e quebram quando há dados de outras origens: `academy_legal` (24), `finance` (69), `finance_extras` (22), `health_access` (20), `feed_social` (48). Em banco limpo (`supabase db reset`, como o CI faz) eles passam: após o reset de 2026-10-21 a suíte teve 1.103 de 1.105 verdes, e as 2 falhas eram as de horário em `challenges`.
- **Dependência de horário:** `challenges.test.sql` (testes 36 e 47 hoje às 09:23; 70 e 75 às 00:17) usa aulas "10 h e 6 h atrás" e datas do dia local; entre 00:00 e ~10:00 (Brasília) as aulas caem no dia anterior ao início do desafio e o teste falha.

**CI (consulta à API pública do GitHub):** as quatro últimas execuções (`4acf44d`, `7a733a8`, `e34db5c`, `c057b8f`) terminaram em **falha** no job `database`, passo `Run npx supabase test db`; os jobs `quality`, `secrets` e `catalog` passaram. As execuções anteriores (`8b5982a` e antes) passaram. A causa não foi lida nos logs (exigem login); é **inferência forte**: as falhas começam em 03:06 UTC (00:06 em Brasília) e a única falha reproduzida em banco limpo e dependente de horário é a de `challenges.test.sql`.

**Não foi possível testar/executar nesta auditoria:** o app mobile em emulador/dispositivo (sem Android SDK configurado nesta máquina; só lint e typecheck), leitor de tela, tema escuro (inexistente), carga/desempenho, backup e restauração, hospedagem (nunca executada), `scripts/smoke-*.mjs` individuais e `e2e-pilot.mjs` (exigem banco limpo; o estado atual é de testes manuais) e o `supabase test db` completo em banco limpo (reset não foi feito para não apagar as contas de teste do usuário).

---

## 5. Interface e experiência do usuário

### 5.1 Telas e rotas existentes (56)
Públicas: `/` , `/login`, `/termos`, `/termos/[slug]`. Aluno: `/perfil`, `/perfil/ficha`, `/diario`, `/diario/novo`, `/diario/[id]`, `/tecnicas`, `/tecnicas/[id]`, `/aulas`, `/checkin/[sessionId]`, `/trilha`, `/graduacao`, `/desafios`, `/desafios/novo`, `/desafios/[id]`, `/financeiro`, `/feed`, `/feed/[academyId]`, `/medalhas`, `/entrar/[slug]`. Responsável: `/dependentes`, `/dependentes/novo`, `/dependentes/[minorId]`, `/dependentes/[minorId]/ficha`, `/dependentes/[minorId]/feed`. Professor/gestor: `/turmas/[classId]`, `/turmas/[classId]/aulas/[sessionId]`, `/academia/[id]` e subrotas (`membros`, `membros/[userId]`, `responsaveis`, `saude`, `financeiro`, `financeiro/planos`, `financeiro/alunos/[userId]`, `turmas`, `curriculos`, `curriculos/[curriculumId]`, `avaliacoes`, `avaliacoes/[userId]`, `graduacao`, `graduacao/nova`, `graduacao/alunos`, `graduacao/alunos/[userId]`, `painel`), `/academias/nova`, `/tecnicas/nova`. Super admin: `/plataforma`, `/plataforma/diarios`. API: `/api/feed/upload`, `/api/feed/image/[postId]`.

### 5.2 Comparação com `DOJO_UI_UX_BRIEF_CLAUDE.md`
| Item do brief | Estado |
|---|---|
| Tokens (cor, espaçamento, tipografia, raio, sombra) | **Feito** (`apps/admin/styles/tokens.css`, ADR-024) |
| Componentes reutilizáveis | **Parcial:** Button, TextField, PasswordField, CheckField, Card, Alert, BrandLogo, Tabs. Faltam AppShell, AcademyThemeProvider, Badge, ProgressBar, EmptyState, LoadingState, Modal/ConfirmDialog, PageHeader, BottomNavigation, SidebarNavigation, TechniqueCard, TrainingLogCard, BeltProgressCard |
| 1. Login/cadastro | **Feito** (abas, responsivo, estados, foco, labels); falta "recuperar senha" (fluxo inexistente) |
| 2. Onboarding e filiação | Não iniciado visualmente (existe a funcionalidade `/entrar/[slug]`) |
| 3. Home do aluno | Não iniciado (hoje `/perfil` com atalhos) |
| 4–5. Diário e catálogo | Funcionais, visual antigo |
| 6. Painel professor/mestre | Funcional, sem sidebar/topbar/grade de cards |
| Tema por academia (tokens) | Só colorização da página de convite; sem logotipo/capa |
| Tema escuro | Não iniciado (tokens preparados) |
| Acessibilidade | Labels, `aria-invalid`, foco visível e tabs por teclado nas telas novas; contraste verificado por inspeção, **sem teste com leitor de tela** |

### 5.3 Avaliação
- **Design System:** base sólida e isolada (camada `legacy` impede regressão); cobre ~8 de ~17 componentes previstos.
- **Responsividade:** boa (passeio em Chrome móvel sem rolagem horizontal nas 56 rotas visitadas e nos 4 tamanhos do login).
- **Navegação:** só links de "Atalhos" no perfil; **sem navegação persistente** (barra inferior no celular, sidebar no desktop).
- **Formulários:** validação no servidor e no cliente; mensagens em português; sem perda de dados digitados nas telas novas; telas antigas ainda limpam campos após erro (comportamento do React 19).
- **Aluno vs. mestre:** o aluno vê um perfil com atalhos (não uma home de progresso); o mestre tem todas as telas de gestão, em formato de lista.
- **Celular:** a web funciona em celular; o **app nativo não entrega nenhuma tela de negócio**.

---

## 6. Comparação com a especificação v1.0

### 6.1 Matriz de rastreabilidade (PRD, `docs/01-prd.md`)
| Requisito | Status | Evidência no código | Teste existente | Pendência |
|---|---|---|---|---|
| RF-01 Cadastro/login e perfil global (P0) | IMPLEMENTADO | `login/*`, `...003_profile_on_signup.sql`, RLS `profiles` | pgTAP `profiles`, `age_gate`; smoke-auth; e2e-login | Recuperação de senha; mobile só login/perfil |
| RF-02 Academia e tema (P0) | PARCIAL | `...004` (contraste), `settings-form.tsx`, `entrar/[slug]` | pgTAP `academy_creation` | Logotipo e capa; tema nas telas internas |
| RF-03 Filiação e decisão auditada (P0) | IMPLEMENTADO | `...005`, `...021` | pgTAP `membership_flow`; smoke-membership; e2e-pilot | — |
| RF-04 Técnicas e categorias (P0) | IMPLEMENTADO | `...006`–`...009`, 131 técnicas globais | pgTAP `technique_catalog` | Revisão técnica do conteúdo pelos professores |
| RF-05 Diário privado (P0) | IMPLEMENTADO | `...010` | pgTAP `training_diary`; smoke-diary | Acesso do super admin deve ser desligado (default `true`) |
| RF-06 Turmas e sessões (P0) | IMPLEMENTADO | `...011` | pgTAP `classes_sessions`; smoke-classes | Plano de aula por sessão não existe |
| RF-07 Presença validada (P0) | IMPLEMENTADO | `...012` | pgTAP `attendance`; smoke-attendance | — |
| RF-08 Regras de graduação e progresso (P0) | IMPLEMENTADO | `...014`, `...016`, `packages/domain` | pgTAP `promotion_rules`, `grant_promotion`; smoke-promotion | Valores reais por faixa/idade a definir pelo dono do produto |
| RF-09 Currículo/trilha (P0) | IMPLEMENTADO | `...013` | pgTAP `curriculum_skills`; smoke-curriculum | — |
| RF-10 Visão administrativa (P1) | IMPLEMENTADO | `...018`, `academia/[id]/painel` | pgTAP `dashboard` | Indicador agregado de "elegíveis" dedicado |
| RF-11 Responsável por menor (P0 com menores) | IMPLEMENTADO | `...021`, `...022`, `...028` | pgTAP `guardians`, `feed_guardian`; smoke-guardians | Revisão jurídica dos termos e consentimentos (rascunho) |

### 6.2 Requisitos não funcionais e gates de `docs/06` e `docs/09`
| Item | Status | Observação |
|---|---|---|
| RLS em todas as entidades privadas + testes negativos | Atendido | 44/44 tabelas; pgTAP |
| RPC transacional para aprovação, presença, graduação | Atendido | funções `security definer` com idempotência |
| `service_role` nunca no cliente | Atendido | sem ocorrências em código |
| Auditoria de eventos críticos | Atendido com ressalva | `audit_events` sem trava de imutabilidade (M-03) |
| Fotos privadas, sem EXIF, retenção | Atendido (no banco, não em Storage) | ADR-022 |
| Termos e política de privacidade | Rascunho | aguarda revisão jurídica |
| Recuperação de conta | **Não atendido** | gate de piloto |
| Exclusão/anonimização (LGPD) e backup testado | **Não verificado** | não há rotina de exclusão de conta nem teste de restauração no repositório |
| Plano de incidentes | **Não verificado** | sem documento |
| Rate limiting | Não definido | sem configuração explícita para produção |
| E2E em navegador no CI | Não atendido | scripts existem mas não rodam no CI (`ci.yml` roda smoke, e2e-pilot e smoke-pages) |
| Hospedagem/homologação | Não executada | guia em `docs/15` |

### 6.3 Divergências entre documentação e implementação
1. `docs/02-arquitetura.md` (seção Storage e diagrama) descreve buckets privados e URLs assinadas; a implementação guarda a foto em `bytea` (ADR-022; `docs/06` já foi atualizado). **Documento 02 desatualizado.**
2. `docs/01-prd.md` lista "Feed social" e "pagamentos" como fora do MVP; ambos foram implementados por decisão do dono do produto (feed e financeiro manual). O PRD só menciona desafios como evolução F2.
3. `docs/06` (matriz) diz "Diário: sem acesso por padrão" para gestor/professor — cumprido; mas o **super admin** lê diários por padrão na fase de teste (`admin_diary_access = true`), situação prevista só em `docs/11`.
4. `docs/features/F2-desafios.md` numera US-015/US-016 como foto da aula e reações; no backlog atual US-015 foi absorvida pela US-018 e as reações são a US-019 (numeração divergente entre documentos).
5. `docs/09` indica "Falta E2E em navegador com cliques"; hoje existem dois scripts de navegador (`e2e-browser.mjs`, `e2e-login.mjs`), fora do CI.
6. ADR-010 diz que `zod` está em `packages/contracts`, mas nenhum `package.json` o declara (M-01).
7. `apps/mobile/README.md` é o texto padrão do Expo (não descreve o projeto).

---

## 7. Riscos e problemas

> **Atualização no mesmo dia (2026-10-21, após a auditoria):** foram corrigidos A-01/C-01 (teste de desafios independente do horário), M-01/C-02 (`zod` declarado em `packages/contracts`), M-02/C-03 (cinco testes isolados do estado do banco), M-03/C-04 (trava de imutabilidade em `audit_events`, migração 032, novo teste) e B-01/C-05 (`/medalhas` no `proxy.ts`). Resultado: `supabase test db` com **1.109 asserções, todas verdes**, no banco local com dados de uso manual; contratos 83/83. A correção do horário foi validada às 20:03; a janela crítica (00:00–10:00) só pode ser reproduzida de madrugada e deve ser conferida pelo CI na próxima execução matinal. O CI remoto ainda não rodou com essas correções.

### CRÍTICO
Nenhum achado confirmado. Não foi encontrada tabela sem RLS, função `security definer` sem `search_path`, uso de `service_role` em cliente, segredo versionado nem rota crítica sem autorização no banco.

### ALTO
- **A-01 — CI vermelho há 4 commits.** Job `database` falha em `supabase test db` desde `4acf44d` (03:06 UTC). Evidência: API pública do GitHub (passo falho confirmado; log não lido). Causa provável e reproduzida localmente: `supabase/tests/database/challenges.test.sql` depende do horário (aulas em `now() - interval '10 hours'`/`'6 hours'`, linhas 36–37, e datas do dia local); falha entre 00:00 e ~10:00 em Brasília. Impacto: o gate de qualidade está inoperante para qualquer commit feito nesse intervalo; já registrado em `docs/11`.
- **A-02 — Recuperação de senha inexistente.** Gate de piloto em `docs/06`; nenhuma tela ou chamada. Quem esquecer a senha fica sem acesso (sem fluxo de suporte documentado).

### MÉDIO
- **M-01 — `zod` é dependência não declarada.** Todos os contratos importam `zod` (v4: `z.uuid()`), mas nenhum `package.json` o lista; só existe no `node_modules` porque `eslint-plugin-react-hooks` (dependência de `eslint-config-next`, devDependency do admin) o traz (`npm ls zod`). Uma atualização do lint pode remover ou trocar a versão e quebrar contratos, admin e mobile. Correção: declarar `zod` em `packages/contracts`. (Defeito de declaração confirmado; a quebra em si é potencial.)
- **M-02 — Testes pgTAP não são isolados do estado do banco.** Cinco testes contam registros globais (`audit_events`, `charges`, comentários) e falham se o banco local tiver dados de uso manual (reproduzido hoje). Só passam após `db reset`; atrapalha o desenvolvimento diário.
- **M-03 — `audit_events` sem trava de imutabilidade.** A tabela só aceita escrita por funções, mas não tem trigger `prevent_mutation` (0 triggers em `pg_trigger`), ao contrário de `promotions`, `manual_assessments` e `charge_events`. Um papel privilegiado pode alterar a trilha de auditoria.
- **M-04 — Foto no banco (`bytea`).** Funciona e é testado, mas cresce a tabela e o backup com o uso (800 KB × posts × 30 dias) e impede CDN; decisão consciente (ADR-022), a reavaliar com volume real.
- **M-05 — App mobile sem telas de negócio** e sem teste de execução. O brief prioriza mobile para o aluno.
- **M-06 — Sem navegação persistente e sem home do aluno.** Impacta a experiência (brief seções 3 e 6).
- **M-07 — Tema da academia limitado a duas cores**, sem logotipo/capa e sem aplicação nas telas internas (RF-02 parcial).
- **M-08 — Exclusão de conta/dados (LGPD), backup e restauração, plano de incidentes** sem evidência no repositório (gates de piloto).
- **M-09 — Limite de tentativas (rate limit) de autenticação não configurado no repositório** para produção.

### BAIXO
- **B-01 — `/medalhas` ausente da lista `PROTECTED` de `apps/admin/proxy.ts:5`.** Sem impacto de segurança (a página chama `getCaller()` que redireciona para o login e as funções exigem membro aprovado), mas é inconsistência com as demais rotas.
- **B-02 — Imagens de referência de UX no repositório público** (4 no histórico, 2 não rastreadas).
- **B-03 — Numeração de histórias divergente** em `docs/features/F2-desafios.md`.
- **B-04 — `apps/mobile/README.md` padrão do Expo.**
- **B-05 — Contagem de pendências:** `docs/11-pendencias.md` tem 170 itens abertos e 17 fechados; precisa de triagem por prioridade (este relatório propõe a ordem).
- **B-06 — Marca provisória** (`BrandLogo`) e selo de desenvolvimento do Next visível no ambiente de dev (some em produção).

---

## 8. Próximos passos (backlog priorizado)

Complexidade: **P** pequena (horas), **M** média (1–3 dias), **G** grande (>3 dias).

### 8.1 Correções necessárias
| ID | Descrição | Prioridade | Depende de | Critérios de aceite | Compl. |
|---|---|---|---|---|---|
| C-01 | Tornar `challenges.test.sql` independente do horário | Alta | — | Suíte passa às 00:30 e às 15:00; CI verde no push | P |
| C-02 | Declarar `zod` em `packages/contracts` (e `typescript` onde faltar); registrar em ADR | Alta | — | `npm ls zod` mostra a dependência declarada; build e testes passam em instalação limpa | P |
| C-03 | Isolar testes pgTAP que contam dados globais (filtrar por ids da fixture) | Média | — | `supabase test db` passa com banco que tenha dados manuais | M |
| C-04 | Trigger de imutabilidade em `audit_events` (`prevent_mutation`) + teste | Média | — | UPDATE/DELETE bloqueados, funções continuam inserindo | P |
| C-05 | Incluir `/medalhas` em `PROTECTED` do proxy | Baixa | — | Anônimo é redirecionado antes de renderizar | P |
| C-06 | Atualizar `docs/02` (Storage), `docs/01` (feed/financeiro) e `docs/features/F2` (numeração) | Baixa | — | Documentos coerentes com ADR-022 e backlog | P |
| C-07 | Decidir sobre as imagens de referência no repositório público | Baixa | decisão do dono | Imagens removidas/ignoradas conforme decisão | P |

### 8.2 Conclusão do MVP
| ID | Descrição | Prioridade | Depende de | Critérios de aceite | Compl. |
|---|---|---|---|---|---|
| M-01 | Recuperação de senha (e-mail do Supabase Auth, tela, mensagens, teste em navegador) | Alta | C-01 | Pedido de redefinição entrega e-mail no Mailpit, link redefine, mensagem igual para e-mail inexistente | M |
| M-02 | Redesign etapa 2: AppShell, navegação (sidebar/barra inferior), home do aluno com progresso, filiação/onboarding | Alta | design system atual | Rotas principais com navegação persistente; passeio em 360/768/1280 sem achados | G |
| M-03 | App mobile: telas do aluno (home, diário, técnicas, check-in, ficha, termos) | Alta | M-02 (design), especificação de UX | Fluxo cadastro → entrar → registrar treino → pedir check-in em emulador Android; testes de lint/typecheck e roteiro manual | G |
| M-04 | Logotipo e capa da academia (armazenamento e exibição) + `AcademyThemeProvider` | Média | ADR de armazenamento | Gestor sobe logotipo; telas mostram marca e cor da academia sem violar contraste | M |
| M-05 | Plano de aula (técnicas planejadas por sessão) | Média | decisão de produto (`plantreino.jpeg`) | Professor associa técnicas à sessão; aluno vê o plano; testes pgTAP | M |
| M-06 | Rotina de exclusão/anonimização de conta e dados + plano de backup/restauração testado | Alta (antes do piloto) | revisão jurídica | Procedimento documentado e executado em ambiente de teste | M |
| M-07 | Hospedagem de homologação (Supabase sa-east-1, Vercel), `pg_cron` habilitado, `admin_diary_access` desligado, `prelaunch-check.sql` verde | Alta (antes do piloto) | C-01, M-01 | Checklist de `docs/15` cumprido; verificador pré-lançamento sem alertas | M |
| M-08 | Rate limit de autenticação e política de senha configurados para produção | Média | M-07 | Configuração versionada e documentada | P |
| M-09 | Revisão jurídica final dos termos e consentimentos (sair de "rascunho") | Alta (antes do piloto) | dono do produto | Textos aprovados; `CURRENT_TERMS_VERSION` atualizada | M |
| M-10 | Definição pelo dono do produto: critérios de graduação reais, limiares das medalhas, regras de idade | Alta | dono do produto | Valores registrados em `docs/` e parametrizados, sem números inventados | P |

### 8.3 Melhorias futuras
| ID | Descrição | Prioridade | Compl. |
|---|---|---|---|
| F-01 | Tema escuro | Baixa | M |
| F-02 | Notificações (push/e-mail) para avisos de marco e filiação | Média | G |
| F-03 | Integração com plataforma de pagamento (com ADR e provedor) | Baixa | G |
| F-04 | Vídeo curto nas técnicas e no feed (migrar mídia para Storage/CDN) | Baixa | G |
| F-05 | E2E de navegador no CI (`e2e-browser`, `e2e-login`) | Média | M |
| F-06 | Marco de treinos por faixa ou por aluno; gestor ajusta o número de outro professor | Baixa | P |
| F-07 | Reações variadas, resposta a comentário, moderação em fila | Baixa | M |

---

## 9. Resumo executivo

**Estado geral.** O produto está **funcionalmente rico no backend e no painel web** e **imaturo no mobile e no visual**. O banco é a parte mais sólida: 44 tabelas, todas com RLS, funções críticas atômicas, idempotentes e auditadas, 1.105 asserções de teste planejadas e 93 telas verificadas por papel. O painel cobre todo o fluxo do PRD (cadastro, academia, filiação, turmas, presença, diário, trilha, graduação, painel) e vai além (responsável de menores, financeiro manual, feed, desafios, medalhas, aviso de treinos).

**O que já pode ser demonstrado hoje (no painel web, ambiente local):** cadastro e login redesenhados; criação de academia; pedido e aprovação de filiação; turma, aula, check-in com QR e validação pelo professor; diário privado; trilha e avaliação de domínio; regras e concessão de graduação; painel de frequência; menores com responsável; financeiro manual; feed com fotos, reações e comentários; medalhas; aviso de 30 treinos configurável por professor.

**O que ainda não funciona:** recuperação de senha; telas do app mobile; logotipo e capa da academia; plano de aula; navegação persistente e home do aluno; vídeo; pagamento online; notificações; exclusão de dados e rotina de backup/restauração; hospedagem de homologação.

**Principais riscos:** (1) CI vermelho há 4 commits por teste dependente de horário; (2) ausência de recuperação de senha e de rotina de exclusão (gates de piloto); (3) `zod` não declarado (fragilidade de instalação); (4) mobile sem telas, embora seja o canal principal do aluno; (5) termos e consentimentos ainda em rascunho jurídico; (6) super admin lê diários por padrão (só aceitável em teste).

**Próximas cinco tarefas recomendadas:** C-01 (teste de desafios sem dependência de horário, para o CI voltar a verde), C-02 (declarar `zod`), M-01 (recuperação de senha), M-02 (AppShell, navegação e home do aluno) e M-10 (definições de produto: critérios reais de graduação e limiares das medalhas). Em paralelo, antes de qualquer piloto: M-06, M-07 e M-09.

**Prontidão para testes com alunos reais:** **NÃO PRONTO para alunos reais.** Pronto para **testes internos controlados com dados sintéticos** (equipe e 1 academia de confiança, sem dados pessoais reais). Bloqueios para o piloto real: recuperação de senha, termos revisados juridicamente, rotina de exclusão e backup testada, hospedagem de homologação com `pg_cron`, `admin_diary_access` desligado, app mobile (se o piloto exigir o celular nativo) e CI verde.

---

### Anexo — Comandos e consultas usados (todos somente leitura ou transacionais)
`git status`, `git log`; leitura de `package.json`, `package-lock.json`, `supabase/config.toml`, migrações, testes, `proxy.ts`, `context.ts`; script Python que cruza `create table` × `enable row level security` × `create policy` × `security definer`/`set search_path` nas 31 migrações; `npm ls zod`; `npm run lint`, `typecheck`, `test`; `npm run build -w @dojo/admin`; `npx supabase test db`; consultas `select` ao banco local (contagens, `pg_trigger`, `cron.job`); API pública `https://api.github.com/repos/dodoxbr/App_Dojo/actions/runs` (somente leitura). Nenhuma chave, senha ou conteúdo de `.env` foi lido ou reproduzido.
