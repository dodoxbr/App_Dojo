# Estratégia de testes

## Unitários
- Progresso 0, parcial, completo, sem regra, histórico vazio, presenças revogadas.
- Normalização de nomes/aliases de técnicas.
- Regras de validação e estados de filiação.

## Integração com banco local
- Usuário A da academia 1 não lê registros privados da academia 2.
- Aluno A não lê diário do aluno B, mesmo na mesma academia.
- Filiação pendente não concede leitura interna.
- Usuário não se promove a mestre por UPDATE.
- Aluno não valida presença nem concede grau.
- Professor de turma A não valida turma B sem autorização.
- Presença duplicada é impedida; transação crítica é idempotente.
- Graduação não pode ser concedida sem autorização.

## E2E
Cadastro → solicitação → aprovação → aula → presença → diário → visualização de progresso → graduação autorizada.
Implementado em `scripts/e2e-pilot.mjs` (jornada pela API) e `scripts/smoke-pages.mjs` (renderização das telas por papel); roda no CI. Falta E2E em navegador com cliques.

## Qualidade
Lint, TypeScript strict, testes unitários e integração obrigatórios antes de PR; CI com checagem de migrações e scanner de segredos. O SQL inicial é apenas fundação e precisa de testes automatizados antes de liberar uso real.
