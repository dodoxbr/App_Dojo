# Contratos de API / RPC (propostos)

## Estratégia
Supabase Auth + consultas com RLS; operações privilegiadas via RPC/Edge Functions. Contratos aqui são **propostas**, não endpoints implementados.

| Operação | Entrada | Saída | Autorização |
|---|---|---|---|
| `request_membership` | academy_id, requested_role=student | membership_id/status | Usuário autenticado |
| `decide_membership` | membership_id, decision, reason, idempotency_key | membership_id/status | Gestor da academia |
| `create_session` | class_id, starts_at | session_id | Professor da turma/gestor |
| `validate_attendance` | session_id, user_id, idempotency_key | attendance_id/status | Professor da turma/gestor |
| `save_training_log` | session_id?, notes, technique_ids[] | log_id | Titular do diário |
| `grant_promotion` | user_id, belt, degree, reason, idempotency_key | promotion_id | Mestre/gestor |

## Convenções
- UUID em IDs; timestamps UTC e apresentação em timezone da academia.
- Erros: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`.
- Não revelar existência de dados de outros tenants em erros.
- Idempotency key em operações críticas; registrar audit event no mesmo commit.
- Validar esquema com Zod no cliente e no limite da operação; autorização é sempre no servidor.
