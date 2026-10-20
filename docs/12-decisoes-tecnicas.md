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

