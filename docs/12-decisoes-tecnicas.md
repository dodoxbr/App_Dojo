# ADRs — registros de decisão

## ADR-001 — Supabase no MVP
**Status:** proposta aceita para baseline. **Contexto:** piloto pequeno e desenvolvimento individual. **Decisão:** PostgreSQL/Auth/RLS/Storage/Edge Functions. **Consequência:** menor custo operacional, maior exigência de disciplina em RLS e RPC.

## ADR-002 — Expo + Next.js
**Status:** proposta aceita para baseline. **Decisão:** TypeScript compartilhado, mobile Expo e painel Next.js. **Consequência:** scaffolding separado e build nativo via EAS quando necessário.

## ADR-003 — Tenant desde o início
**Status:** obrigatório. **Decisão:** academy_id em registros operacionais, filiação global por usuário, políticas de isolamento e testes negativos.

## ADR-004 — Diário e catálogo como core
**Status:** obrigatório. **Decisão:** técnicas como entidades relacionais, diário privado e trilhas configuráveis.

## ADR-005 — Graduação não automática
**Status:** obrigatório. **Decisão:** elegibilidade calculada e promoção concedida somente por ator autorizado.

## ADR-006 — Supabase CLI como devDependency
**Status:** aceita (US-001). **Contexto:** CLI não instalada e o CI precisa do mesmo binário. **Decisão:** `supabase` com versão fixa na raiz, usada via `npx supabase`. **Consequência:** versão reproduzível local/CI; requer Docker.

## ADR-007 — Ferramental de qualidade
**Status:** aceita (US-001). **Decisão:** TypeScript strict, ESLint (flat config, via Next/Expo) e gitleaks no CI (scanner de segredos, `docs/09`). Testes de domínio seguem `node --test`; testes de banco usam pgTAP via `supabase test db`. **Consequência:** sem framework de teste JS adicional por ora.

## ADR-008 — Scaffold dos apps
**Status:** aceita (US-001). **Decisão:** `apps/admin` com Next.js (App Router) e `apps/mobile` com Expo Router, ambos TypeScript strict e workspaces npm, com tela mínima e sem features. Conforme ADR-002. **Consequência:** versões fixadas no lockfile; build nativo via EAS fica para depois.

## ADR-009 — Privilégios mínimos no banco
**Status:** aceita (US-001). **Decisão:** migration dedicada revoga privilégios padrão de `anon`/`authenticated` e concede por tabela só o que as políticas RLS usam; novas tabelas não herdam grants. **Consequência:** cada história que cria tabela deve declarar seus grants.


## ADR-011 — Papéis, auditoria e operações no servidor (US-003)
**Status:** aceita (US-003). **Decisão:** super admin em `platform_admins` (inserido só por SQL, nunca pelo app); criadores liberados em `academy_creators`; matriz de permissões do instrutor por academia em `academy_role_permissions`; `audit_events` escrita só por operações `security definer` com `search_path` vazio e `EXECUTE` apenas para `authenticated`. Erros: 28000, 42501, P0002, 23505, 22023. **Consequência:** nenhum INSERT/UPDATE direto de cliente nessas tabelas; o contraste do tema é validado no banco e espelhado em `packages/contracts` com os mesmos valores de referência.

## ADR-012 — Catálogo, busca e importação por seed gerada (US-005)
**Status:** aceita (US-005). **Decisão:** busca no Postgres com a extensão `unaccent` e uma função `normalize_text` declarada IMMUTABLE (permite índice único por nome normalizado); sem `pg_trgm`, índice de texto ou busca externa até haver volume que justifique. Seed do catálogo **gerada** por script Python da biblioteca padrão (lê o `.xlsx` sem alterá-lo), com UUID v5 estável e data de revisão fixa, versionada como migration e conferida no CI (drift). **Consequência:** nenhuma dependência nova; busca por trecho (`like '%q%'`) varre a tabela, aceitável para centenas de técnicas, a reavaliar com milhares.

## ADR-013 — Correções e classificação do catálogo por migration gerada (US-005)
**Status:** aceita. **Decisão:** a seed original (007) permanece imutável; correções de nome e a classificação proposta entram em migration separada (009), gerada de `name_corrections.csv` e `classification.csv`, que são a fonte revisável. IDs derivam dos nomes originais da planilha, então correções não mudam IDs. Coluna chamada `technique_position` (e não `position`) por conflito com palavra do SQL. **Consequência:** o gerador falha se uma correção causar duplicata ou não casar com a planilha; o CI confere o resultado.

## ADR-014 — Presença: núcleo único, token por hash e biblioteca de QR (US-008)
**Status:** aceita. **Decisão:** manual e QR usam a mesma tabela e as mesmas operações; o QR carrega um token aleatório de uso restrito (uma aula, 15 minutos) guardado só como hash SHA-256 e **nunca** valida sozinho. Dependência nova `qrcode` (+ `@types/qrcode`) apenas em `apps/admin`, para gerar o SVG no servidor; sem câmera nem biblioteca de leitura (o aluno escaneia com o celular e abre o link). **Consequência:** a leitura do QR depende do navegador do aluno estar logado; o link exige um toque de confirmação.

## ADR-015 — Regras de graduação definidas pela academia e idempotência estrita (US-010)
**Status:** aceita. **Decisão:** nenhum número de graduação é embutido; a regra é dado da academia, versionada (versão nova encerra a anterior, nunca edita) e composta por critérios tipados (`min_days`, `attendance`, `curriculum`, `manual`), com restrição no banco que exige exatamente os parâmetros de cada tipo. A avaliação é uma função somente leitura que devolve uma recomendação. Graduação atual e decisões manuais são tabelas só de inserção (gatilho bloqueia UPDATE/DELETE). Chave de idempotência só repete a mesma requisição: mudar o alvo ou a decisão com a mesma chave é erro (migration 015 corrige `decide_membership` e `assess_skill`). **Consequência:** novos tipos de critério exigem migration (decisão consciente para manter a validação no banco).

## ADR-016 — Concessão de graduação e retificação como eventos (US-011)
**Status:** aceita. **Decisão:** a graduação é um log de eventos imutável (`initial`, `promotion`, `correction`); retificar é inserir um evento que aponta para o corrigido (`corrects_promotion_id`, único) e a graduação atual é o último evento não substituído, exposto pela visão `current_ranks` com `security_invoker`. A concessão serializa por membro com `pg_advisory_xact_lock`, é idempotente de forma estrita e registra na auditoria se o sistema recomendava a promoção naquele instante. **Consequência:** nenhuma correção apaga história; qualquer consulta de "graduação atual" deve usar a visão (ou o mesmo filtro).

## ADR-017 — Indicadores agregados e teste de telas com o app real (US-012)
**Status:** aceita. **Decisão:** métricas de uso saem de contadores (dia, academia, técnica) sem identificar pessoas; agregados de dados privados (diário, consultas) só são exibidos acima de um tamanho mínimo de grupo definido em `min_group_size()`. O painel é uma função SQL somente leitura que devolve JSON validado por Zod no cliente. Para testar as telas sem nova dependência, `scripts/smoke-pages.mjs` sobe `next start`, gera os cookies de sessão com `@supabase/ssr` e faz `fetch` de cada rota por papel; navegador com cliques (Playwright) fica como evolução e exigiria dependência e ADR. **Consequência:** o teste de telas cobre renderização e autorização, não interações de formulário.

## ADR-018 — Conta do menor criada e usada pelo responsável (US-013 parte 2)
**Status:** aceita. **Decisão do dono do produto:** o responsável cria a conta e responde por ela; quem usa o app é o responsável; existe também o responsável financeiro. **Decisão técnica:** o dependente é uma linha de `auth.users` **sem e-mail, senha nem identidade** (ninguém consegue entrar como o menor), criada por `create_dependent` (função `security definer` do banco, com idempotência estrita e limite de 10 dependentes por responsável). Alternativas descartadas: criar o usuário pela Admin API exigiria `service_role` num servidor do painel (fere `docs/06` e o `CLAUDE.md`), e uma tabela de dependentes separada exigiria refazer todas as chaves `user_id` (presença, graduação, filiação). O vínculo é `guardianships` (um responsável **legal** por menor, no máximo um **financeiro** separado, por convite com código em hash, 7 dias, uso único); o consentimento é por academia em `guardian_consents` e só vale depois que o gestor confere o documento do responsável **pessoalmente** (nada do documento é guardado). `decide_membership` só aprova menor com `can_join_academy`; revogar o consentimento suspende o menor na hora. **Consequência:** o `auth.users` passa a ter linhas criadas fora do GoTrue (depende das colunas da tabela do Supabase Auth; o teste de banco e o smoke detectam quebra em atualização); aos 18 anos o acesso do responsável cessa por regra, mas a **assunção da conta pelo jovem** (e-mail próprio) ainda não existe e exigirá a Admin API ou fluxo de convite (pendência).

## ADR-010 — Dependências de autenticação (US-002)
**Status:** aceita (US-002). **Decisão:** `zod` em `packages/contracts` (esquemas compartilhados, `docs/02`/`docs/07`); `@supabase/supabase-js` nos dois apps; `@supabase/ssr` no admin (sessão por cookies); `expo-secure-store` no mobile (token fora de armazenamento em texto puro). Sem `service_role` em nenhum cliente. **Consequência:** `packages/contracts` exporta TypeScript direto (sem build); o admin precisa de `transpilePackages`. SecureStore limita ~2 KB por valor, então o adaptador de sessão divide em partes.
