-- US-010: promotion rules and progress evaluation. All belt names and numbers below are FICTITIOUS test data.
begin;
select plan(65);

-- Fixtures (as postgres)
-- a1 platform admin | m1 manager ac01 | i1, i2 instructors | s1, s2, s3 students | x1 manager ac02 | o1 outsider
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test'),
 ('00000000-0000-0000-0000-0000000000c1', 'instrutor1@example.test'),
 ('00000000-0000-0000-0000-0000000000c2', 'instrutor2@example.test'),
 ('00000000-0000-0000-0000-0000000000d1', 'aluno1@example.test'),
 ('00000000-0000-0000-0000-0000000000d2', 'aluno2@example.test'),
 ('00000000-0000-0000-0000-0000000000d3', 'aluno3@example.test'),
 ('00000000-0000-0000-0000-0000000000e1', 'gestor2@example.test'),
 ('00000000-0000-0000-0000-0000000000f1', 'externo@example.test');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'regras-um', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'regras-dois', '00000000-0000-0000-0000-0000000000e1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c2', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e1', 'manager', 'approved');
insert into public.academy_role_permissions (academy_id, role, permission) values
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'view_roster'),
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'validate_attendance'),
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'recommend_graduation');
-- a curriculum with 2 required + 1 optional techniques (real catalog techniques)
insert into public.curricula (id, academy_id, title) values
 ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-00000000ac01', 'Trilha Teste'),
 ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-00000000ac02', 'Trilha Outra Academia');
insert into public.curriculum_items (academy_id, curriculum_id, technique_id, required, position)
  select '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c9', t.id, n.req, n.pos
  from (values ('Tesoura', true, 1), ('Postura', true, 2), ('Toreando', false, 3)) as n(name, req, pos)
  join public.techniques t on t.name = n.name and t.academy_id is null;
-- sessions of one class, at different distances from now
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-00000000ac01', 'Turma Teste', '00000000-0000-0000-0000-0000000000c1');
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at)
  select ('00000000-0000-0000-0000-00000000' || n.id)::uuid, '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b9',
         now() - n.ago, now() - n.ago + interval '1 hour'
  from (values ('5a01', interval '20 days'), ('5a02', interval '10 days'), ('5a03', interval '10 days' - interval '1 minute'),
               ('5a04', interval '40 days'), ('5a05', interval '5 days'), ('5a06', interval '3 days'),
               ('5a07', interval '7 days'), ('5a08', interval '6 days')) as n(id, ago);
-- attendances of s1: 5a01,5a02,5a03 validated (after the rank date); 5a04 validated but BEFORE it;
-- 5a05 pending; 5a06 revoked; (5a07, 5a08 are added later in the test)
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at, revoked_by, revoked_at, revoked_reason)
  select '00000000-0000-0000-0000-00000000ac01', ('00000000-0000-0000-0000-00000000' || n.id)::uuid, '00000000-0000-0000-0000-0000000000d1',
         'teacher', n.st,
         case when n.st = 'validated' then '00000000-0000-0000-0000-0000000000c1'::uuid end,
         case when n.st = 'validated' then now() end,
         case when n.st = 'revoked' then '00000000-0000-0000-0000-0000000000c1'::uuid end,
         case when n.st = 'revoked' then now() end,
         case when n.st = 'revoked' then 'motivo de teste' end
  from (values ('5a01', 'validated'), ('5a02', 'validated'), ('5a03', 'validated'), ('5a04', 'validated'),
               ('5a05', 'pending'), ('5a06', 'revoked')) as n(id, st);

set local role authenticated;

-- Initial rank -----------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2')->>'has_rank')::boolean, false, 'sem graduacao registrada: nao avalia');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 1, current_date - 30, null, gen_random_uuid())$$, '42501', null, 'instrutor nao registra graduacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 1, current_date - 30, 'cadastro inicial de teste', '10101010-1010-1010-1010-101010101010')$$, 'gestor registra a graduacao atual');
select is((select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 1, current_date - 30, 'cadastro inicial de teste', '10101010-1010-1010-1010-101010101010')),
          (select id from public.promotions where user_id = '00000000-0000-0000-0000-0000000000d1'), 'registro idempotente');
select throws_ok($$select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste B', 2, current_date - 1, null, gen_random_uuid())$$, '23505', null, 'so ha uma graduacao inicial (depois e promocao/correcao)');
select throws_ok($$select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'Faixa Teste A', 1, current_date + 5, null, gen_random_uuid())$$, '22023', null, 'data futura rejeitada');
select throws_ok($$select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000f1', 'Faixa Teste A', 1, current_date, null, gen_random_uuid())$$, '22023', null, 'quem nao e membro nao tem graduacao');
select lives_ok($$select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'Faixa Teste A', 1, current_date - 30, null, gen_random_uuid())$$, 'gestor registra a graduacao do aluno 2');
select lives_ok($$select public.register_initial_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'Faixa Sem Regra', 3, current_date - 10, null, gen_random_uuid())$$, 'gestor registra a graduacao do aluno 3');
select throws_ok($$insert into public.promotions (academy_id, user_id, belt_code, degree, event_type, effective_date, created_by) values ('00000000-0000-0000-0000-00000000ac01','00000000-0000-0000-0000-0000000000d1','X',0,'initial',current_date,'00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'sem INSERT direto em promotions');

-- Rules ------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[{"kind":"min_days","label":"Tempo","min_days":20}]'::jsonb, gen_random_uuid())$$, '42501', null, 'instrutor nao cria regra');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[]'::jsonb, gen_random_uuid())$$, '22023', null, 'regra sem criterios rejeitada');
select throws_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[{"kind":"inventado","label":"X1"}]'::jsonb, gen_random_uuid())$$, '22023', null, 'tipo de criterio desconhecido rejeitado');
select throws_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[{"kind":"min_days","label":"Tempo"}]'::jsonb, gen_random_uuid())$$, '22023', null, 'criterio sem o parametro do seu tipo rejeitado');
select throws_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[{"kind":"min_days","label":"Tempo","min_days":"muitos"}]'::jsonb, gen_random_uuid())$$, '22023', null, 'parametro invalido rejeitado');
select throws_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[{"kind":"min_days","label":"Tempo","min_days":10,"min_percent":50}]'::jsonb, gen_random_uuid())$$, '22023', null, 'parametro de outro tipo rejeitado');
select throws_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[{"kind":"curriculum","label":"Tecnica","curriculum_id":"00000000-0000-0000-0000-0000000000ca","min_percent":50}]'::jsonb, gen_random_uuid())$$, '22023', null, 'curriculo de outra academia rejeitado');
select throws_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[{"kind":"manual","label":"Igual"},{"kind":"manual","label":"igual"}]'::jsonb, gen_random_uuid())$$, '22023', null, 'criterios com o mesmo nome rejeitados');
select lives_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, 'Regra de teste', current_date - 60, '[
  {"kind":"min_days","label":"Tempo minimo","min_days":20},
  {"kind":"attendance","label":"Assiduidade","min_attendances":4},
  {"kind":"curriculum","label":"Nivel tecnico","curriculum_id":"00000000-0000-0000-0000-0000000000c9","min_percent":50},
  {"kind":"manual","label":"Comprometimento"}]'::jsonb, '20202020-2020-2020-2020-202020202020')$$, 'gestor cria a regra com 4 tipos de criterio');
select is((select count(*)::int from public.rule_criteria), 4, 'quatro criterios gravados');
select is((select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, 'Regra de teste', current_date - 60, '[{"kind":"min_days","label":"Tempo minimo","min_days":20}]'::jsonb, '20202020-2020-2020-2020-202020202020')),
          (select id from public.promotion_rules where version = 1), 'criacao idempotente');
select throws_ok($$insert into public.rule_criteria (academy_id, rule_id, position, kind, label, min_days) values ('00000000-0000-0000-0000-00000000ac01', (select id from public.promotion_rules limit 1), 9, 'min_days', 'Direto', 5)$$, '42501', null, 'sem INSERT direto em rule_criteria');

-- Evaluation, rule v1 (3 valid attendances after the rank date; pending / revoked / older ones do not count)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->>'eligible')::boolean, false, 'aluno ainda nao elegivel');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->0->>'met')::boolean, true, 'tempo: 30 dias >= 20 dias');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->1->>'current')::int, 3, 'assiduidade conta so validadas apos a graduacao (nao conta pendente, revogada nem anterior)');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->1->>'met')::boolean, false, 'assiduidade: 3 < 4');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->2->>'current')::int, 0, 'nivel tecnico: 0% das obrigatorias');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->3->>'met')::boolean, false, 'manual: ainda nao avaliado');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->>'recommendation_only')::boolean, true, 'resultado e so recomendacao');
select throws_ok($$select public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2')$$, '42501', null, 'aluno nao avalia outro aluno');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'externo nao avalia');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'gestor de outra academia nao avalia');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3')->>'has_rule')::boolean, false, 'graduacao sem regra cadastrada: nao ha avaliacao');

-- Technical level (curriculum) and manual criteria
reset role;
insert into public.skill_assessments (academy_id, user_id, technique_id, status, status_source, assessed_by, assessed_at)
  select '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', id, 'validated', 'teacher', '00000000-0000-0000-0000-0000000000c1', now()
  from public.techniques where name = 'Tesoura' and academy_id is null;
-- an old "met" decision made BEFORE the rank date must not count for s2
insert into public.manual_assessments (academy_id, user_id, criterion_key, met, assessed_by, assessed_at)
  values ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'comprometimento', true, '00000000-0000-0000-0000-0000000000c1', now() - interval '40 days');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->2->>'current')::int, 50, 'nivel tecnico: 1 de 2 obrigatorias validadas = 50%');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->2->>'met')::boolean, true, 'nivel tecnico atendido');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2')->'criteria'->3->>'met')::boolean, false, 'decisao manual anterior a ultima graduacao nao conta');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok($$select public.assess_manual_criterion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Comprometimento', true, null, gen_random_uuid())$$, '42501', null, 'aluno nao avalia o proprio criterio');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.assess_manual_criterion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Criterio Inexistente', true, null, gen_random_uuid())$$, '22023', null, 'so avalia criterio manual que existe na regra');
select is((select public.assess_manual_criterion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', '  COMPROMETIMENTO ', true, 'frequenta e se dedica', '30303030-3030-3030-3030-303030303030')), true, 'professor com recommend_graduation avalia o criterio manual');
select is((select public.assess_manual_criterion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Comprometimento', true, 'frequenta e se dedica', '30303030-3030-3030-3030-303030303030')), true, 'avaliacao idempotente');
select throws_ok($$select public.assess_manual_criterion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Comprometimento', false, null, '30303030-3030-3030-3030-303030303030')$$, '22023', null, 'mesma chave com dados diferentes = VALIDATION_ERROR');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->3->>'met')::boolean, true, 'criterio manual atendido');
select throws_ok($$update public.manual_assessments set met = false$$, '42501', null, 'historico manual nao e editavel por clientes');

-- Rule v2: window + distinct days. v1 is closed the day before.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'faixa  teste a', 1, null, current_date - 60, '[{"kind":"min_days","label":"Tempo","min_days":5}]'::jsonb, gen_random_uuid())$$, '22023', null, 'nova versao precisa comecar depois da versao atual');
select lives_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'FAIXA teste A', 1, 'Versao 2', current_date - 1, '[
  {"kind":"attendance","label":"Dias com treino","min_attendances":3,"window_days":15,"distinct_days":true},
  {"kind":"manual","label":"Comprometimento"}]'::jsonb, gen_random_uuid())$$, 'gestor cria a versao 2 (janela de 15 dias, dias distintos)');
select is((select version from public.promotion_rules where title = 'Versao 2'), 2, 'versao incrementada');
select is((select effective_to from public.promotion_rules where version = 1), current_date - 2, 'a versao anterior foi fechada no dia anterior');
select throws_ok($$update public.promotion_rules set title = 'Hack'$$, '42501', null, 'regras nao sao editaveis por clientes');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'rule'->>'version')::int, 2, 'avaliacao usa a versao vigente');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->'criteria'->0->>'current')::int, 1, 'janela de 15 dias com dias distintos: duas aulas no mesmo dia contam 1');
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->>'eligible')::boolean, false, 'ainda nao elegivel pela versao 2');

-- two more validated days inside the window make the student eligible: still only a recommendation
reset role;
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
  select '00000000-0000-0000-0000-00000000ac01', ('00000000-0000-0000-0000-00000000' || n.id)::uuid, '00000000-0000-0000-0000-0000000000d1',
         'teacher', 'validated', '00000000-0000-0000-0000-0000000000c1', now()
  from (values ('5a07'), ('5a08')) as n(id);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->>'eligible')::boolean, true, 'todos os criterios atendidos: elegivel (recomendacao)');
select is((select count(*)::int from public.promotions where user_id = '00000000-0000-0000-0000-0000000000d1'), 1, 'elegibilidade nao promove ninguem');

-- Reads and permissions
select is((select count(*)::int from public.promotion_rules where academy_id = '00000000-0000-0000-0000-00000000ac01'), 2, 'aluno aprovado le as regras da academia (versoes inclusive)');
select is((select count(*)::int from public.promotions), 1, 'aluno ve apenas a propria graduacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*)::int from public.promotion_rules) + (select count(*)::int from public.rule_criteria), 0, 'externo nao le as regras');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.set_instructor_permission('00000000-0000-0000-0000-00000000ac01', 'recommend_graduation', false)$$, 'gestor retira recommend_graduation dos instrutores');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$select public.assess_manual_criterion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'Comprometimento', true, null, gen_random_uuid())$$, '42501', null, 'sem a permissao o instrutor nao avalia criterio manual');
select throws_ok($$select public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'nem avalia o progresso do aluno');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((public.evaluate_promotion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1')->>'eligible')::boolean, true, 'gestor ve a avaliacao');
select lives_ok($$select public.assess_manual_criterion('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'Comprometimento', true, null, gen_random_uuid())$$, 'gestor continua avaliando criterios manuais');

-- Immutability even for privileged roles
reset role;
select throws_ok($$update public.promotions set degree = 9$$, '55000', null, 'promotions e append-only (UPDATE)');
select throws_ok($$delete from public.promotions$$, '55000', null, 'promotions e append-only (DELETE)');
select throws_ok($$delete from public.manual_assessments$$, '55000', null, 'historico de avaliacoes manuais e append-only');
select ok((select count(*) from public.audit_events where action in ('promotion_rule.create', 'rank.initial', 'criterion.assess')) >= 6, 'operacoes auditadas');

select * from finish();
rollback;
