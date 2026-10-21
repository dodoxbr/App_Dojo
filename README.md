# Dojo Platform — Especificação v1.0 + starter técnico

**Status:** baseline para revisão, não produto pronto. Nome comercial provisório.

## Propósito
SaaS multiacademia de Jiu-Jitsu, com diário de treino e catálogo técnico como centro da experiência; cadastro/filiação, aulas, presenças e evolução por graus compõem o MVP. Outras modalidades e recursos comerciais são extensões.

## Comece por aqui
1. Leia `docs/00-decisoes-e-premissas.md`, `docs/01-prd.md`, `docs/02-arquitetura.md`, `docs/03-modelo-dados.md`, `docs/04-regras-negocio.md` e `CLAUDE.md`.
2. Leia `docs/10-backlog.md` e implemente somente a fatia `US-001` antes das demais.
3. Configure o Supabase local e execute as migrações em `supabase/migrations`.
4. **Não publique** até concluir as políticas de acesso, testes de segurança, proteção de menores e fluxos de aprovação.
5. Para **testar no navegador**: `docs/16-roteiro-de-testes.md`. Para **hospedar** (teste na internet e produção): `docs/15-guia-de-publicacao.md`; antes de abrir para pessoas reais, rode `scripts/prelaunch-check.sql`.

## Conteúdo
- `docs/`: requisitos, arquitetura, segurança, UX, decisões, backlog, testes e instruções.
- `supabase/migrations/`: esquema SQL e políticas iniciais com privilégios mínimos.
- `packages/domain/`: funções puras TypeScript para cálculo de progresso, com testes.
- `apps/mobile/` (Expo Router) e `apps/admin/` (Next.js): scaffold mínimo da US-001, sem features.
- `prompts/`: prompts prontos para execução incremental no Claude Code.
- `references/`: fonte do Claude fornecida pelo usuário.

## Escopo e limites
O código incluído é uma **fundação inicial verificável**, não um aplicativo completo. As funcionalidades dependentes de autenticação, upload, aprovação, QR e telas serão implementadas por histórias. As regras de faixa são configuráveis; não foram importados critérios oficiais de graduação. A planilha de treino original deve ser analisada e validada com o mestre antes da carga.
