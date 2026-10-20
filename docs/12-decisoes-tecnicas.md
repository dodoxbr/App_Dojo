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

## ADR-010 — Dependências de autenticação (US-002)
**Status:** aceita (US-002). **Decisão:** `zod` em `packages/contracts` (esquemas compartilhados, `docs/02`/`docs/07`); `@supabase/supabase-js` nos dois apps; `@supabase/ssr` no admin (sessão por cookies); `expo-secure-store` no mobile (token fora de armazenamento em texto puro). Sem `service_role` em nenhum cliente. **Consequência:** `packages/contracts` exporta TypeScript direto (sem build); o admin precisa de `transpilePackages`. SecureStore limita ~2 KB por valor, então o adaptador de sessão divide em partes.
