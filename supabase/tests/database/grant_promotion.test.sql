-- US-011: granting a promotion and rectification. All belt names and numbers are FICTITIOUS test data.
begin;
select plan(59);

-- Fixtures (as postgres)
-- a1 platform admin | m1 manager ac01 | i1 instructor (recommend_graduation, view_progress) | s1, s2, s3 students
-- x1 manager ac02 | o1 outsider
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test'),
 ('00000000-0000-0000-0000-0000000000c1', 'instrutor@example.test'),
 ('00000000-0000-0000-0000-0000000000d1', 'aluno1@example.test'),
 ('00000000-0000-0000-0000-0000000000d2', 'aluno2@example.test'),
 ('00000000-0000-0000-0000-0000000000d3', 'aluno3@example.test'),
 ('00000000-0000-0000-0000-0000000000e1', 'gestor2@example.test'),
 ('00000000-0000-0000-0000-0000000000f1', 'externo@example.test');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'promo-um', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'promo-dois', '00000000-0000-0000-0000-0000000000e1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e1', 'manager', 'approved');
insert into public.academy_role_permissions (academy_id, role, permission) values
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'recommend_graduation'),
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'view_progress');
-- the manager's own rank (to test the self-promotion block)
insert into public.promotions (academy_id, user_id, belt_code, degree, event_type, effective_date, created_by) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'Faixa Teste Z', 1, 'initial', current_date - 400, '00000000-0000-0000-0000-0000000000a1');
-- one attendance of s1, 10 days ago (it must stop counting after a later promotion)
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-00000000ac01', 'Turma Teste', '00000000-0000-0000-0000-0000000000c1');
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at) values
 ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b9', now() - interval '10 days', now() - interval '10 days' + interval '1 hour');
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d1', 'teacher', 'validated', '00000000-0000-0000-0000-0000000000c1', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- Setup through the real operations: initial ranks and the academy's own rules
select lives_ok($$select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 1, current_date - 30, null, gen_random_uuid())$$, 'rank inicial de s1 (30 dias atras)');
select lives_ok($$select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'Faixa Teste A', 1, current_date - 2, null, gen_random_uuid())$$, 'rank inicial de s3 (2 dias atras)');
select lives_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[{"kind":"min_days","label":"Tempo","min_days":5}]'::jsonb, gen_random_uuid())$$, 'regra: 5 dias para sair de A/1');
select lives_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 2, null, current_date - 60, '[{"kind":"attendance","label":"Presencas","min_attendances":1}]'::jsonb, gen_random_uuid())$$, 'regra: 1 presenca para sair de A/2');

-- Eligibility alone promotes nobody
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->>'eligible')::boolean, true, 's1 e elegivel (recomendacao)');
select is((select count(*)::int from public.promotions where user_id = '00000000-0000-0000-0000-0000000000d1'), 1, 'ser elegivel nao cria promocao');

-- Authorization -------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 2, current_date, 'tentativa', gen_random_uuid())$$, '42501', null, 'instrutor (mesmo recomendando) nao concede graduacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 2, current_date, 'eu mesmo', gen_random_uuid())$$, '42501', null, 'aluno nao promove a si mesmo');
select throws_ok($$insert into public.promotions (academy_id, user_id, belt_code, degree, event_type, effective_date, created_by) values ('00000000-0000-0000-0000-00000000ac01','00000000-0000-0000-0000-0000000000d1','X',9,'promotion',current_date,'00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'sem INSERT direto em promotions');
select throws_ok($$update public.promotions set degree = 9$$, '42501', null, 'sem UPDATE direto em promotions');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 2, current_date, 'outra academia', gen_random_uuid())$$, '42501', null, 'gestor de outra academia nao concede');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'Faixa Teste Z', 2, current_date, 'auto promocao', gen_random_uuid())$$, '42501', null, 'gestor nao promove a si mesmo');

-- Validation -------------------------------------------------------------------------------------------------
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'Faixa Teste A', 2, current_date, 'sem rank atual', gen_random_uuid())$$, '22023', null, 'sem graduacao atual registrada: nao promove');
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000f1', 'Faixa Teste A', 2, current_date, 'nao e membro', gen_random_uuid())$$, '22023', null, 'quem nao e membro nao e promovido');
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'faixa  TESTE a', 1, current_date, 'mesma graduacao', gen_random_uuid())$$, '22023', null, 'destino igual a graduacao atual = VALIDATION_ERROR');
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 2, current_date - 31, 'antes da atual', gen_random_uuid())$$, '22023', null, 'data anterior a graduacao atual rejeitada');
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 2, current_date + 3, 'futuro', gen_random_uuid())$$, '22023', null, 'data futura rejeitada');
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 2, current_date, 'ok', gen_random_uuid())$$, '22023', null, 'justificativa curta rejeitada');
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 21, current_date, 'grau invalido', gen_random_uuid())$$, '22023', null, 'grau fora do intervalo rejeitado');
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', '   ', 2, current_date, 'faixa vazia', gen_random_uuid())$$, '22023', null, 'faixa vazia rejeitada');

-- Granting -----------------------------------------------------------------------------------------------------
select lives_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 2, current_date - 1, 'avaliacao do gestor (teste)', '40404040-4040-4040-4040-404040404040')$$, 'gestor concede a graduacao');
select is((select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 2, current_date - 1, 'avaliacao do gestor (teste)', '40404040-4040-4040-4040-404040404040')),
          (select id from public.promotions where event_type = 'promotion' and user_id = '00000000-0000-0000-0000-0000000000d1'), 'concessao idempotente');
select throws_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 5, current_date - 1, 'outra coisa', '40404040-4040-4040-4040-404040404040')$$, '22023', null, 'mesma chave com outro destino = VALIDATION_ERROR');
select is((select count(*)::int from public.promotions where user_id = '00000000-0000-0000-0000-0000000000d1'), 2, 'inicial + promocao (sem duplicar)');
select is((select previous_degree from public.promotions where event_type = 'promotion' and user_id = '00000000-0000-0000-0000-0000000000d1'), 1, 'guarda o grau anterior');
select is((select previous_belt_code from public.promotions where event_type = 'promotion' and user_id = '00000000-0000-0000-0000-0000000000d1'), 'Faixa Teste A', 'guarda a faixa anterior');
select is((select degree from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 2, 'a graduacao atual passou a ser a nova');
select is((select (metadata ->> 'recommended_at_grant')::boolean from public.audit_events where action = 'promotion.grant' and metadata ->> 'user_id' = '00000000-0000-0000-0000-0000000000d1'), true, 'auditoria registra que o sistema recomendava');
select is((select metadata -> 'from' ->> 'degree' from public.audit_events where action = 'promotion.grant' and metadata ->> 'user_id' = '00000000-0000-0000-0000-0000000000d1'), '1', 'auditoria registra o grau anterior');

-- The new rank is the new milestone: the old attendance (10 days ago) no longer counts
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'rank'->>'degree')::int, 2, 'a avaliacao usa a nova graduacao');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->0->>'current')::int, 0, 'a contagem de presencas recomeca na nova graduacao');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->>'eligible')::boolean, false, 'e deixa de ser elegivel para o proximo passo');

-- The manager decides even without a recommendation, and the audit says so
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'Faixa Teste A', 2, current_date, 'decisao do mestre (teste)', gen_random_uuid())$$, 'gestor pode conceder mesmo sem recomendacao');
select is((select (metadata ->> 'recommended_at_grant')::boolean from public.audit_events where action = 'promotion.grant' and metadata ->> 'user_id' = '00000000-0000-0000-0000-0000000000d3'), false, 'e a auditoria registra que NAO havia recomendacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.grant_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste B', 0, current_date, 'concedida pelo super admin (teste)', gen_random_uuid())$$, 'super admin tambem pode conceder (teste)');

-- Rectification ---------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.correct_promotion((select id from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 'Faixa Teste B', 1, current_date, 'instrutor', gen_random_uuid())$$, '42501', null, 'instrutor nao retifica');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok($$select public.correct_promotion((select id from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 'Faixa Teste B', 1, current_date, 'aluno', gen_random_uuid())$$, '42501', null, 'aluno nao retifica a propria graduacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.correct_promotion(gen_random_uuid(), 'Faixa Teste B', 1, current_date, 'inexistente', gen_random_uuid())$$, '42501', null, 'retificar evento inexistente = mesmo erro');
select throws_ok($$select public.correct_promotion((select id from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 'Faixa Teste B', 0, current_date, 'x', gen_random_uuid())$$, '22023', null, 'retificacao exige justificativa');
select throws_ok($$select public.correct_promotion((select id from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 'Faixa Teste B', 0, current_date, 'nada muda', gen_random_uuid())$$, '22023', null, 'retificacao sem mudanca rejeitada');
select lives_ok($$select public.correct_promotion((select id from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 'Faixa Teste B', 3, current_date, 'grau digitado errado (teste)', '50505050-5050-5050-5050-505050505050')$$, 'gestor retifica a graduacao atual');
select is((select degree from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 3, 'a graduacao atual e a retificada');
select is((select event_type from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 'correction', 'e e uma retificacao');
select is((select count(*)::int from public.promotions where user_id = '00000000-0000-0000-0000-0000000000d1'), 4, 'o historico completo continua (inicial, promocao, promocao e retificacao)');
select is((select count(*)::int from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 1, 'a visao devolve uma unica graduacao atual por pessoa');
select is((select public.correct_promotion((select corrects_promotion_id from public.promotions where event_type = 'correction'), 'Faixa Teste B', 3, current_date, 'grau digitado errado (teste)', '50505050-5050-5050-5050-505050505050')),
          (select id from public.promotions where event_type = 'correction'), 'retificacao idempotente (a mesma chave nao cria outra)');
select throws_ok($$select public.correct_promotion((select corrects_promotion_id from public.promotions where event_type = 'correction'), 'Faixa Teste C', 1, current_date, 'segunda retificacao do mesmo evento', gen_random_uuid())$$, '23505', null, 'um evento ja retificado nao pode ser retificado de novo');
select lives_ok($$select public.correct_promotion((select id from public.promotions where event_type = 'correction'), 'Faixa Teste B', 1, current_date, 'retificando a retificacao (teste)', gen_random_uuid())$$, 'a retificacao pode ser retificada');
select is((select degree from public.current_ranks where user_id = '00000000-0000-0000-0000-0000000000d1'), 1, 'vale a ultima retificacao');
select throws_ok($$select public.correct_promotion((select id from public.promotions where event_type = 'promotion' and user_id = '00000000-0000-0000-0000-0000000000b1' limit 1), 'X', 1, current_date, 'inexistente de verdade', gen_random_uuid())$$, '42501', null, 'sem evento nao ha o que retificar');

-- Reads: history for the person and for those who follow progress
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.promotions), 5, 'aluno ve o proprio historico completo');
select is((select count(*)::int from public.current_ranks), 1, 'e a propria graduacao atual');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select is((select count(*)::int from public.promotions where user_id = '00000000-0000-0000-0000-0000000000d1'), 0, 'outro aluno nao ve o historico de s1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok((select count(*) from public.promotions where user_id = '00000000-0000-0000-0000-0000000000d1') >= 4, 'instrutor com view_progress ve o historico');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*)::int from public.promotions) + (select count(*)::int from public.current_ranks), 0, 'externo nao ve graduacoes');

-- Immutability and audit
reset role;
select throws_ok($$update public.promotions set degree = 9$$, '55000', null, 'historico e append-only (UPDATE)');
select throws_ok($$delete from public.promotions where event_type = 'correction'$$, '55000', null, 'historico e append-only (DELETE)');
select ok((select count(*) from public.audit_events where action = 'promotion.grant') >= 3, 'concessoes auditadas');
select ok((select count(*) from public.audit_events where action = 'promotion.correct') >= 2, 'retificacoes auditadas');

select * from finish();
rollback;
