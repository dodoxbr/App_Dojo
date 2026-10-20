-- US-012: dashboard and pilot indicators. Synthetic data; expected numbers are worked out by hand in the comments.
begin;
select plan(45);

-- Fixtures (as postgres)
-- Academy A: m1 manager, i1 instructor (view_progress), s1..s6 students, p1 pending, r1 rejected
-- Academy B (below the minimum group size): x1 manager, y1, y2 students. o1 outsider.
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000000000' || n.id)::uuid, n.email
  from (values ('a1','admin@example.test'),('b1','gestor@example.test'),('c1','instrutor@example.test'),
               ('d1','aluno1@example.test'),('d2','aluno2@example.test'),('d3','aluno3@example.test'),('d4','aluno4@example.test'),
               ('d5','aluno5@example.test'),('d6','aluno6@example.test'),('d7','pendente@example.test'),('d8','rejeitado@example.test'),
               ('e1','gestor2@example.test'),('e2','aluno-b1@example.test'),('e3','aluno-b2@example.test'),('f1','externo@example.test')) as n(id, email);
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia A', 'painel-a', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia B', 'painel-b', '00000000-0000-0000-0000-0000000000e1');
insert into public.memberships (academy_id, user_id, role, status)
  select '00000000-0000-0000-0000-00000000ac01', ('00000000-0000-0000-0000-0000000000' || m.id)::uuid, m.role::public.membership_role, m.st::public.membership_status
  from (values ('b1','manager','approved'),('c1','instructor','approved'),
               ('d1','student','approved'),('d2','student','approved'),('d3','student','approved'),('d4','student','approved'),
               ('d5','student','approved'),('d6','student','approved'),('d7','student','pending'),('d8','student','rejected')) as m(id, role, st);
insert into public.memberships (academy_id, user_id, role, status)
  select '00000000-0000-0000-0000-00000000ac02', ('00000000-0000-0000-0000-0000000000' || m.id)::uuid, m.role::public.membership_role, 'approved'
  from (values ('e1','manager'),('e2','student'),('e3','student')) as m(id, role);
insert into public.academy_role_permissions (academy_id, role, permission) values
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'view_progress');
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-00000000ac01', 'Turma Painel', '00000000-0000-0000-0000-0000000000c1');
-- Sessions: H1 (3 days ago), H2 (2 days ago), C1 cancelled (4 days ago), F1 in the future; plus weekly ones for retention
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at, status)
  select ('00000000-0000-0000-0000-00000000' || n.id)::uuid, '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b9',
         n.starts, n.starts + interval '1 hour', n.st
  from (values
    ('5a01', now() - interval '3 days', 'scheduled'),
    ('5a02', now() - interval '2 days', 'scheduled'),
    ('5a03', now() - interval '4 days', 'cancelled'),
    ('5a04', now() + interval '2 days', 'scheduled'),
    -- Wednesdays at noon (academy time zone), 5 / 3 / 2 weeks before the current week
    ('5b05', (date_trunc('week', now() at time zone 'America/Sao_Paulo') + interval '2 days 12 hours') at time zone 'America/Sao_Paulo' - interval '35 days', 'scheduled'),
    ('5b03', (date_trunc('week', now() at time zone 'America/Sao_Paulo') + interval '2 days 12 hours') at time zone 'America/Sao_Paulo' - interval '21 days', 'scheduled'),
    ('5b02', (date_trunc('week', now() at time zone 'America/Sao_Paulo') + interval '2 days 12 hours') at time zone 'America/Sao_Paulo' - interval '14 days', 'scheduled')
  ) as n(id, starts, st);
-- H1: s1 validated (30 min after asking), s2 validated (10 min), s3 pending, s4 revoked
-- H2: s1 validated by the teacher (no request: excluded from the median), s5 validated (20 min)  => median of {30,10,20} = 20
insert into public.attendances (academy_id, session_id, user_id, source, status, requested_at, validated_by, validated_at, revoked_by, revoked_at, revoked_reason)
  select '00000000-0000-0000-0000-00000000ac01', ('00000000-0000-0000-0000-00000000' || a.sid)::uuid, ('00000000-0000-0000-0000-0000000000' || a.uid)::uuid,
         a.src, a.st, now() - a.ago, case when a.st = 'validated' then '00000000-0000-0000-0000-0000000000c1'::uuid end,
         case when a.st = 'validated' then now() - a.ago + a.took end,
         case when a.st = 'revoked' then '00000000-0000-0000-0000-0000000000c1'::uuid end,
         case when a.st = 'revoked' then now() end, case when a.st = 'revoked' then 'motivo de teste' end
  from (values
    ('5a01','d1','manual','validated', interval '3 days', interval '30 minutes'),
    ('5a01','d2','qr','validated', interval '3 days', interval '10 minutes'),
    ('5a01','d3','manual','pending', interval '3 days', interval '0'),
    ('5a01','d4','manual','revoked', interval '3 days', interval '0'),
    ('5a02','d1','teacher','validated', interval '2 days', interval '0'),
    ('5a02','d5','manual','validated', interval '2 days', interval '20 minutes'),
    ('5b03','d1','teacher','validated', interval '21 days', interval '0'),
    ('5b03','d2','teacher','validated', interval '21 days', interval '0'),
    ('5b02','d1','teacher','validated', interval '14 days', interval '0'),
    ('5b05','d3','teacher','validated', interval '35 days', interval '0')) as a(sid, uid, src, st, ago, took);
-- Diary entries: s1 and s2 wrote this week (counted), s3 only 10 days ago (not counted); y1 belongs to another academy
insert into public.training_logs (user_id, notes, created_at) values
 ('00000000-0000-0000-0000-0000000000d1', 'segredo do aluno 1', now()),
 ('00000000-0000-0000-0000-0000000000d2', 'segredo do aluno 2', now()),
 ('00000000-0000-0000-0000-0000000000d3', 'segredo antigo', now() - interval '10 days'),
 ('00000000-0000-0000-0000-0000000000e2', 'segredo de outra academia', now());
-- Ranks (s1 and s2) for the eligibility list
insert into public.promotions (academy_id, user_id, belt_code, degree, event_type, effective_date, created_by) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'Faixa Teste A', 1, 'initial', current_date - 30, '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'Faixa Teste B', 1, 'initial', current_date - 30, '00000000-0000-0000-0000-0000000000b1');

set local role authenticated;

-- Rules through the real operation: s1's rank needs 5 days (eligible), s2's needs 3650 days (not eligible)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste A', 1, null, current_date - 60, '[{"kind":"min_days","label":"Tempo","min_days":5}]'::jsonb, gen_random_uuid())$$, 'regra da faixa A');
select lives_ok($$select public.create_promotion_rule('00000000-0000-0000-0000-00000000ac01', 'Faixa Teste B', 1, null, current_date - 60, '[{"kind":"min_days","label":"Tempo","min_days":3650}]'::jsonb, gen_random_uuid())$$, 'regra da faixa B');

-- Technique views are counters, never people
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok($$select public.record_technique_view((select id from public.techniques where name = 'Tesoura' and academy_id is null))$$, 's1 consulta Tesoura');
select lives_ok($$select public.record_technique_view((select id from public.techniques where name = 'Tesoura' and academy_id is null))$$, 's1 consulta Tesoura de novo');
select throws_ok($$select * from public.technique_views$$, '42501', null, 'contadores nao sao legiveis por clientes');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select lives_ok($$select public.record_technique_view((select id from public.techniques where name = 'Postura' and academy_id is null))$$, 's2 consulta Postura');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select lives_ok($$select public.record_technique_view((select id from public.techniques where name = 'Tesoura' and academy_id is null))$$, 'aluno da academia B consulta Tesoura');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select lives_ok($$select public.record_technique_view((select id from public.techniques where name = 'Tesoura' and academy_id is null))$$, 'quem nao tem academia nao gera contagem (e nao falha)');
reset role;
select is((select sum(views)::int from public.technique_views where academy_id in ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000ac02')), 4, 'so 4 consultas contadas (2 + 1 + 1 de B); o externo nao conta');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'technique_views' and column_name in ('user_id', 'created_by', 'viewer_id')), 0, 'a tabela de contadores nao tem coluna de pessoa');
set local role authenticated;

-- Authorization
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok($$select public.academy_dashboard('00000000-0000-0000-0000-00000000ac01', 7)$$, '42501', null, 'aluno nao ve o painel');
select throws_ok($$select * from public.eligible_students('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'aluno nao ve a lista de elegiveis');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.academy_dashboard('00000000-0000-0000-0000-00000000ac01', 7)$$, '42501', null, 'externo nao ve o painel');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.academy_dashboard('00000000-0000-0000-0000-00000000ac01', 7)$$, '42501', null, 'gestor de outra academia nao ve o painel');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.academy_dashboard('00000000-0000-0000-0000-00000000ac01', 3)$$, '22023', null, 'periodo fora de 7 a 365 dias rejeitado');

-- Academy A (7 days): the numbers worked out above
select set_config('test.dash', public.academy_dashboard('00000000-0000-0000-0000-00000000ac01', 7)::text, true);
select is((current_setting('test.dash')::jsonb -> 'privacy' ->> 'enough_members')::boolean, true, 'academia A tem membros suficientes (6 alunos >= 5)');
select is((current_setting('test.dash')::jsonb -> 'activation' ->> 'approved')::int, 7, 'ativacao: 6 alunos + 1 instrutor aprovados');
select is((current_setting('test.dash')::jsonb -> 'activation' ->> 'pending')::int, 1, 'ativacao: 1 pendente');
select is((current_setting('test.dash')::jsonb -> 'activation' ->> 'rejected')::int, 1, 'ativacao: 1 rejeitado');
select is((current_setting('test.dash')::jsonb -> 'attendance' ->> 'sessions_held')::int, 2, 'aulas realizadas no periodo: 2 (a cancelada e a futura nao entram)');
select is((current_setting('test.dash')::jsonb -> 'attendance' ->> 'sessions_cancelled')::int, 1, 'aulas canceladas: 1');
select is((current_setting('test.dash')::jsonb -> 'attendance' ->> 'validated')::int, 4, 'presencas validadas: 4');
select is((current_setting('test.dash')::jsonb -> 'attendance' ->> 'pending')::int, 1, 'pendentes: 1');
select is((current_setting('test.dash')::jsonb -> 'attendance' ->> 'revoked')::int, 1, 'revogadas: 1 (nao contam como presenca)');
select is((current_setting('test.dash')::jsonb -> 'attendance' ->> 'avg_validated_per_session')::numeric, 2.0, 'media de validadas por aula: 2,0');
select is((current_setting('test.dash')::jsonb -> 'attendance' ->> 'median_minutes_to_validate')::numeric, 20.0, 'mediana do tempo ate confirmar: 20 min (30, 10 e 20; o lancamento do professor nao entra)');
select is((current_setting('test.dash')::jsonb -> 'by_class' -> 0 ->> 'validated')::int, 4, 'frequencia por turma: 4 validadas');
select is((select (e ->> 'active')::int from jsonb_array_elements(current_setting('test.dash')::jsonb -> 'retention') e
           where (e ->> 'week_start')::date = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date - 21), 2, 'retencao: 2 ativos 3 semanas atras');
select is((select (e ->> 'retained_next_week')::int from jsonb_array_elements(current_setting('test.dash')::jsonb -> 'retention') e
           where (e ->> 'week_start')::date = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date - 21), 1, 'retencao: 1 deles voltou na semana seguinte');
select is((current_setting('test.dash')::jsonb -> 'diary' ->> 'with_entry_last_7_days')::int, 2, 'diario: 2 alunos registraram nos ultimos 7 dias');
select is((current_setting('test.dash')::jsonb -> 'diary' ->> 'percent')::numeric, 33.3, 'diario: 33,3% dos alunos');
select is((current_setting('test.dash')::jsonb -> 'techniques' ->> 'total_views')::int, 3, 'consultas da academia A: 3 (a de B nao entra)');
select is(current_setting('test.dash')::jsonb -> 'techniques' -> 'top' -> 0 ->> 'name', 'Tesoura', 'tecnica mais consultada: Tesoura');
select is((current_setting('test.dash')::jsonb -> 'techniques' -> 'top' -> 0 ->> 'views')::int, 2, 'com 2 consultas');
select is(position('segredo' in current_setting('test.dash')) + position('00000000-0000-0000-0000-0000000000d1' in current_setting('test.dash')), 0, 'o painel nao traz conteudo de diario nem identifica quem consultou');

-- Academy B is below the minimum group size: private-data aggregates are hidden
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select set_config('test.dashb', public.academy_dashboard('00000000-0000-0000-0000-00000000ac02', 7)::text, true);
select is((current_setting('test.dashb')::jsonb -> 'privacy' ->> 'enough_members')::boolean, false, 'academia B tem poucos membros (2 < 5)');
select is(current_setting('test.dashb')::jsonb -> 'diary', 'null'::jsonb, 'diario oculto em academia pequena');
select is(current_setting('test.dashb')::jsonb -> 'techniques', 'null'::jsonb, 'tecnicas mais consultadas ocultas em academia pequena');

-- Eligible list: only s1; the permission follows the manager's matrix
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.eligible_students('00000000-0000-0000-0000-00000000ac01')), 1, 'lista de elegiveis: so o aluno 1');
select is((select user_id from public.eligible_students('00000000-0000-0000-0000-00000000ac01')), '00000000-0000-0000-0000-0000000000d1'::uuid, 'e e o aluno 1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((public.academy_dashboard('00000000-0000-0000-0000-00000000ac01', 7) -> 'privacy' ->> 'students')::int, 6, 'instrutor com view_progress ve o painel');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.set_instructor_permission('00000000-0000-0000-0000-00000000ac01', 'view_progress', false)$$, 'gestor retira view_progress');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.academy_dashboard('00000000-0000-0000-0000-00000000ac01', 7)$$, '42501', null, 'sem a permissao o instrutor perde o painel');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.academy_dashboard(gen_random_uuid(), 7)$$, 'P0002', null, 'super admin: academia inexistente = NOT_FOUND');

reset role;
select is((select count(*)::int from public.promotions where academy_id = '00000000-0000-0000-0000-00000000ac01' and user_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')), 2, 'listar elegiveis nao cria promocao');

select * from finish();
rollback;
