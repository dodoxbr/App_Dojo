-- US-007: classes and sessions. Synthetic data only.
begin;
select plan(41);

-- Fixtures (as postgres)
-- a1 platform admin | m1 manager ac01 | i1 responsible instructor | i2 other instructor | s1 student | p1 pending
-- x1 manager ac02 | y1 instructor ac02 | u1 plain user
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test'),
 ('00000000-0000-0000-0000-0000000000c1', 'instrutor1@example.test'),
 ('00000000-0000-0000-0000-0000000000c2', 'instrutor2@example.test'),
 ('00000000-0000-0000-0000-0000000000d1', 'aluno@example.test'),
 ('00000000-0000-0000-0000-0000000000d2', 'pendente@example.test'),
 ('00000000-0000-0000-0000-0000000000e1', 'gestor2@example.test'),
 ('00000000-0000-0000-0000-0000000000e2', 'instrutor3@example.test'),
 ('00000000-0000-0000-0000-0000000000f1', 'comum@example.test');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'turmas-um', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'turmas-dois', '00000000-0000-0000-0000-0000000000e1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c2', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'pending'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e2', 'instructor', 'approved');

select is((select timezone from public.academies where id = '00000000-0000-0000-0000-00000000ac01'), 'America/Sao_Paulo', 'fuso padrao da academia');

set local role authenticated;

-- Manager creates classes -------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.create_class('00000000-0000-0000-0000-00000000ac01', '  Turma Iniciantes  ', '00000000-0000-0000-0000-0000000000c1', '66666666-6666-6666-6666-666666666666')$$, 'gestor cria turma');
select is((select public.create_class('00000000-0000-0000-0000-00000000ac01', 'Turma Iniciantes', '00000000-0000-0000-0000-0000000000c1', '66666666-6666-6666-6666-666666666666')),
          (select id from public.classes where title = 'Turma Iniciantes'), 'criacao idempotente');
select is((select count(*)::int from public.classes where academy_id = '00000000-0000-0000-0000-00000000ac01'), 1, 'sem turma duplicada');
select lives_ok($$select public.create_class('00000000-0000-0000-0000-00000000ac01', 'Turma do Gestor', '00000000-0000-0000-0000-0000000000b1', gen_random_uuid())$$, 'gestor pode ser o instrutor da turma');
select throws_ok($$select public.create_class('00000000-0000-0000-0000-00000000ac01', 'TURMA  iniciantes', '00000000-0000-0000-0000-0000000000c2', gen_random_uuid())$$, '23505', null, 'titulo ativo duplicado (ignorando caixa/espacos) = CONFLICT');
select throws_ok($$select public.create_class('00000000-0000-0000-0000-00000000ac01', 'Turma Aluno', '00000000-0000-0000-0000-0000000000d1', gen_random_uuid())$$, '22023', null, 'aluno nao pode ser instrutor da turma');
select throws_ok($$select public.create_class('00000000-0000-0000-0000-00000000ac01', 'Turma Pendente', '00000000-0000-0000-0000-0000000000d2', gen_random_uuid())$$, '22023', null, 'filiacao pendente nao pode ser instrutor');
select throws_ok($$select public.create_class('00000000-0000-0000-0000-00000000ac01', 'Turma Outra Academia', '00000000-0000-0000-0000-0000000000e2', gen_random_uuid())$$, '22023', null, 'instrutor de outra academia nao pode');
select throws_ok($$select public.create_class('00000000-0000-0000-0000-00000000ac01', 'x', '00000000-0000-0000-0000-0000000000c1', gen_random_uuid())$$, '22023', null, 'titulo curto = VALIDATION_ERROR');
select throws_ok($$insert into public.classes (academy_id, title, instructor_user_id) values ('00000000-0000-0000-0000-00000000ac01', 'Direta', '00000000-0000-0000-0000-0000000000c1')$$, '42501', null, 'sem INSERT direto em classes');

-- Not authorized to create/update classes
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.create_class('00000000-0000-0000-0000-00000000ac01', 'Turma do Instrutor', '00000000-0000-0000-0000-0000000000c1', gen_random_uuid())$$, '42501', null, 'instrutor nao cria turma');
select throws_ok($$select public.update_class((select id from public.classes where title = 'Turma Iniciantes'), 'Renomeada', '00000000-0000-0000-0000-0000000000c1', true)$$, '42501', null, 'instrutor nao edita turma');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.create_class('00000000-0000-0000-0000-00000000ac01', 'Invasao', '00000000-0000-0000-0000-0000000000c1', gen_random_uuid())$$, '42501', null, 'gestor de outra academia nao cria turma');

-- Sessions by the responsible instructor ----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$select public.create_session((select id from public.classes where title = 'Turma Iniciantes'), '2026-11-02', '19:00', '20:00', '77777777-7777-7777-7777-777777777777')$$, 'instrutor responsavel agenda aula');
select is((select starts_at from public.sessions limit 1), '2026-11-02 22:00:00+00'::timestamptz, 'horario local 19:00 vira 22:00 UTC (America/Sao_Paulo)');
select is((select ends_at from public.sessions limit 1), '2026-11-02 23:00:00+00'::timestamptz, 'fim da aula convertido');
select is((select public.create_session((select id from public.classes where title = 'Turma Iniciantes'), '2026-11-02', '19:00', '20:00', '77777777-7777-7777-7777-777777777777')),
          (select id from public.sessions limit 1), 'agendamento idempotente');
select throws_ok($$select public.create_session((select id from public.classes where title = 'Turma Iniciantes'), '2026-11-02', '19:00', '20:30', gen_random_uuid())$$, '23505', null, 'mesma turma e horario = CONFLICT');
select throws_ok($$select public.create_session((select id from public.classes where title = 'Turma Iniciantes'), '2026-11-03', '20:00', '19:00', gen_random_uuid())$$, '22023', null, 'fim antes do inicio = VALIDATION_ERROR');
select throws_ok($$select public.create_session((select id from public.classes where title = 'Turma Iniciantes'), '2031-01-01', '19:00', '20:00', gen_random_uuid())$$, '22023', null, 'data muito distante = VALIDATION_ERROR');
select throws_ok($$insert into public.sessions (academy_id, class_id, starts_at, ends_at) values ('00000000-0000-0000-0000-00000000ac01', (select id from public.classes limit 1), now(), now() + interval '1 hour')$$, '42501', null, 'sem INSERT direto em sessions');

-- Instructor who is NOT responsible / student / other academy
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$select public.create_session((select id from public.classes where title = 'Turma Iniciantes'), '2026-11-04', '19:00', '20:00', gen_random_uuid())$$, '42501', null, 'instrutor de outra turma nao agenda');
select throws_ok($$select public.cancel_session((select id from public.sessions limit 1), null)$$, '42501', null, 'instrutor de outra turma nao cancela');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok($$select public.create_session((select id from public.classes where title = 'Turma Iniciantes'), '2026-11-04', '19:00', '20:00', gen_random_uuid())$$, '42501', null, 'aluno nao agenda');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.create_session((select id from public.classes where title = 'Turma Iniciantes'), '2026-11-04', '19:00', '20:00', gen_random_uuid())$$, '42501', null, 'gestor de outra academia nao agenda');
select throws_ok($$select public.cancel_session(gen_random_uuid(), null)$$, '42501', null, 'cancelar sessao inexistente = mesmo erro (nao revela existencia)');

-- Manager: schedules too, cancels, edits the class -----------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.create_session((select id from public.classes where title = 'Turma Iniciantes'), '2026-11-04', '19:00', '20:00', gen_random_uuid())$$, 'gestor agenda aula de qualquer turma');
select lives_ok($$select public.cancel_session((select id from public.sessions where starts_at = '2026-11-04 22:00:00+00'), 'feriado')$$, 'gestor cancela aula');
select is((select status from public.sessions where starts_at = '2026-11-04 22:00:00+00'), 'cancelled', 'aula cancelada');
select lives_ok($$select public.cancel_session((select id from public.sessions where starts_at = '2026-11-04 22:00:00+00'), 'feriado')$$, 'cancelar de novo e idempotente');
select lives_ok($$select public.update_class((select id from public.classes where title = 'Turma Iniciantes'), 'Turma Iniciantes Noite', '00000000-0000-0000-0000-0000000000c2', true)$$, 'gestor troca titulo e instrutor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.create_session((select id from public.classes where title = 'Turma Iniciantes Noite'), '2026-11-05', '19:00', '20:00', gen_random_uuid())$$, '42501', null, 'instrutor antigo perde o direito de agendar');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.update_class((select id from public.classes where title = 'Turma do Gestor'), 'Turma do Gestor', '00000000-0000-0000-0000-0000000000b1', false)$$, 'gestor desativa turma');
select throws_ok($$select public.create_session((select id from public.classes where title = 'Turma do Gestor'), '2026-11-06', '19:00', '20:00', gen_random_uuid())$$, '22023', null, 'turma inativa nao recebe aula');

-- Reads ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.classes), 2, 'aluno aprovado le as turmas da academia');
select is((select count(*)::int from public.sessions), 2, 'e a agenda');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select is((select count(*)::int from public.classes) + (select count(*)::int from public.sessions), 0, 'filiacao pendente nao le turmas nem aulas');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from public.classes) + (select count(*)::int from public.sessions), 0, 'gestor de outra academia nao le');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.classes where academy_id in ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000ac02')), 2, 'super admin le as turmas de todas as academias');
select is((select count(*)::int from public.audit_events where academy_id in ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000ac02') and action in ('class.create', 'class.update', 'session.create', 'session.cancel')), 7, 'operacoes auditadas (cancelar de novo nao gera outro evento)');

select * from finish();
rollback;
