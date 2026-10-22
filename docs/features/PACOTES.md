# Pacotes por academia (Oss)

**Objetivo:** cada academia tem um pacote que liga ou desliga funcionalidades opcionais. Hoje todas as academias ficam no pacote **Avançado** (tudo ligado). O conteúdo de cada pacote é **valor de TESTE**: o dono do produto define os finais e os preços (ver `docs/11-pendencias.md`).

## Regras
- **Núcleo nunca depende de pacote:** conta, filiação, turmas e aulas, presença, diário, técnicas, graduação, menores e responsáveis, saúde e termos.
- **Funcionalidades opcionais (7):** financeiro (`finance`), feed (`feed`), desafios (`challenges`), medalhas (`medals`), painel (`dashboard`), trilhas e avaliações (`curriculum`), aviso de treinos por professor (`milestone`).
- **Aplicação no banco:** gatilhos barram a criação de dados novos de uma funcionalidade desligada com erro `0A000` (`FEATURE_DISABLED: <funcionalidade>`). Apagar e moderar continuam permitidos; o que já existe fica guardado. A leitura só some na interface (o dado não é apagado).
- **Cobrança automática:** `run_auto_charges` pula academias sem `finance`.
- **Quem muda:** só o super admin (função `set_academy_plan` e `update_plan_features`), com auditoria (`academy.plan`, `plan.features`).
- **Conteúdo de teste:** Inicial = nenhuma opcional; Intermediário = financeiro, painel, trilhas, aviso de treinos; Avançado = todas.

## Telas
- `/plataforma`: seletor de pacote por academia.
- `/plataforma/pacotes`: o que cada pacote inclui (edição).
- Menus e atalhos escondem o que o pacote não inclui; páginas diretas mostram "recurso não incluído" (`FeatureOff`).

## Critérios de aceite e testes
- pgTAP `supabase/tests/database/academy_plans.test.sql` (29 asserções): padrão Avançado, só super admin altera, `0A000` nas ações das 6 funcionalidades principais no pacote Inicial, restaurar libera, apagar post liberado com feed desligado, auditoria, `run_auto_charges` não falha.
- `packages/contracts/tests/features.test.ts`; `scripts/smoke-pages.mjs` cobre `/plataforma/pacotes`.

## Riscos
- Leitura de dados de funcionalidade desligada só é escondida na interface.
- Lista de funcionalidades existe no banco (`feature_catalog`) e em `packages/contracts/src/features.ts`: manter as duas iguais.
