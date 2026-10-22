# Contrato de desenvolvimento — Claude Code

Você é responsável por implementar um SaaS multiacademia de Jiu-Jitsu seguindo `docs/` como fonte de verdade. Idioma: pt-BR.

## Regras inegociáveis
1. Trabalhe **uma história por vez**, da especificação ao teste; antes de codificar, indique arquivos alterados, riscos e critérios de aceite.
2. Não invente requisitos, números de graduação ou conteúdo técnico. Registre lacunas em `docs/11-pendencias.md` e use dados fictícios explicitamente rotulados.
3. Dados privados são isolados por academia; o atleta possui identidade global e filiações distintas. Nunca confie em `academy_id`, `role` ou `user_id` enviados pelo cliente sem validação no banco.
4. Toda tabela com dados de academia deve ter RLS habilitada e política testada. Negar por padrão. Não expor service_role no cliente.
5. Ações críticas (aprovação, validação de presença, graduação) devem ser atômicas e server-side, com autorização, idempotência e auditoria. Não criar UPDATE público direto.
6. Diário é privado por padrão; compartilhar com professor exige permissão explícita. Dados de crianças exigem responsáveis e proteção reforçada.
7. O aluno não altera graduação oficial; só informa graduação declarada, que exige confirmação.
8. Não contabilizar log de treino como presença; somente presença validada e não revogada.
9. Evitar overengineering: Supabase + Postgres + Expo + Next.js, sem microserviços e sem NestJS no MVP.
10. Nunca rodar migrações destrutivas ou publicar dados reais sem autorização; use migrações versionadas, lint, testes e revisão.
11. Não instalar dependências ou alterar arquitetura sem registrar ADR e justificar.
12. Ao concluir uma história, entregue resumo, comandos executados, testes aprovados/falhos e pendências.
13. Interface: siga o padrão visual oficial em `docs/18-design-system.md` (tokens em `apps/admin/styles/tokens.css`); não crie cores, fontes ou estilos fora dele.

## Sequência
`docs/10-backlog.md` → história → migration/RLS → testes → interface → revisão. Comece por `prompts/01-primeira-sessao.md`.
