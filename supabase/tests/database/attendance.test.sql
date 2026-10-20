-- US-008: attendance (manual + QR share one core). Synthetic data only.
begin;
select plan(65);

-- Fixtures (as postgres)
-- a1 platform admin | m1 manager ac01 | i1 instructor of C1 | i2 instructor of C2 | s1..s4 students | p1 pending
-- o1 outsider | x1 manager ac02 | y1 student ac02
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test'),
 ('00000000-0000-0000-0000-0000000000c1', 'instrutor1@example.test'),
 ('00000000-0000-0000-0000-0000000000c2', 'instrutor2@example.test'),
 ('00000000-0000-0000-0000-0000000000d1', 'aluno1@example.test'),
 ('00000000-0000-0000-0000-0000000000d2', 'aluno2@example.test'),
 ('00000000-0000-0000-0000-0000000000d3', 'aluno3@example.test'),
 ('00000000-0000-0000-0000-0000000000d4', 'aluno4@example.test'),
 ('00000000-0000-0000-0000-0000000000d5', 'pendente@example.test'),
 ('00000000-0000-0000-0000-0000000000e1', 'externo@example.test'),
 ('00000000-0000-0000-0000-0000000000f1', 'gestor2@example.test'),
 ('00000000-0000-0000-0000-0000000000f2', 'aluno-outra@example.test');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'presenca-um', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'presenca-dois', '00000000-0000-0000-0000-0000000000f1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c2', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d4', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d5', 'student', 'pending'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000f1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000f2', 'student', 'approved');
-- default instructor permissions, as create_academy would set them
insert into public.academy_role_permissions (academy_id, role, permission) values
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'view_roster'),
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'validate_attendance');
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-00000000ac01', 'Turma Um', '00000000-0000-0000-0000-0000000000c1'),
 ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-00000000ac01', 'Turma Dois', '00000000-0000-0000-0000-0000000000c2'),
 ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-00000000ac02', 'Turma Outra', '00000000-0000-0000-0000-0000000000f1');
-- sessions relative to now(): ongoing, future, past, cancelled, other class, other academy
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at, status) values
 ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c9', now() - interval '10 minutes', now() + interval '50 minutes', 'scheduled'),
 ('00000000-0000-0000-0000-000000005a02', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c9', now() + interval '5 days', now() + interval '5 days 1 hour', 'scheduled'),
 ('00000000-0000-0000-0000-000000005a03', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c9', now() - interval '5 days', now() - interval '5 days' + interval '1 hour', 'scheduled'),
 ('00000000-0000-0000-0000-000000005a04', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c9', now() - interval '11 minutes', now() + interval '49 minutes', 'cancelled'),
 ('00000000-0000-0000-0000-000000005a05', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000ca', now() - interval '9 minutes', now() + interval '51 minutes', 'scheduled'),
 ('00000000-0000-0000-0000-000000005a06', '00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000cb', now() - interval '9 minutes', now() + interval '51 minutes', 'scheduled');

set local role authenticated;

-- s1: manual check-in --------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01')$$, 'aluno pede check-in manual');
select is((select status || '/' || source from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d1'), 'pending/manual', 'nasce pendente (nao conta ainda)');
select is((select public.request_check_in('00000000-0000-0000-0000-000000005a01')), (select id from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d1'), 'repetir o pedido e idempotente');
select is((select count(*)::int from public.attendances), 1, 'uma presenca por aluno e aula');
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a04')$$, '22023', null, 'aula cancelada nao recebe check-in');
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a02')$$, '22023', null, 'aula futura (fora da janela) nao recebe check-in');
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a03')$$, '22023', null, 'aula antiga (fora da janela) nao recebe check-in');
select throws_ok($$insert into public.attendances (academy_id, session_id, user_id, source) values ('00000000-0000-0000-0000-00000000ac01','00000000-0000-0000-0000-000000005a01','00000000-0000-0000-0000-0000000000d2','manual')$$, '42501', null, 'sem INSERT direto em attendances');
select throws_ok($$update public.attendances set status = 'validated'$$, '42501', null, 'aluno nao se valida por UPDATE');
select throws_ok($$select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d1', gen_random_uuid())$$, '42501', null, 'aluno nao valida a propria presenca');
select throws_ok($$select * from public.create_check_in_token('00000000-0000-0000-0000-000000005a01')$$, '42501', null, 'aluno nao gera token de QR');
select throws_ok($$select * from public.check_in_tokens$$, '42501', null, 'tokens nao sao legiveis por clientes');

-- not allowed to check in
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01')$$, '42501', null, 'externo nao faz check-in');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}', true);
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01')$$, '42501', null, 'filiacao pendente nao faz check-in');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01')$$, '42501', null, 'aluno de outra academia nao faz check-in');
select throws_ok($$select public.request_check_in(gen_random_uuid())$$, '42501', null, 'aula inexistente = mesmo erro');

-- privacy between students
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select is((select count(*)::int from public.attendances), 0, 'colega nao ve a presenca de s1');

-- instructor of ANOTHER class
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d1', gen_random_uuid())$$, '42501', null, 'instrutor de outra turma nao valida');
select throws_ok($$select * from public.create_check_in_token('00000000-0000-0000-0000-000000005a01')$$, '42501', null, 'instrutor de outra turma nao gera QR');
select is((select count(*)::int from public.attendances), 0, 'nem le as presencas da turma alheia');
select throws_ok($$select public.revoke_attendance((select id from public.attendances limit 1), 'motivo valido')$$, '42501', null, 'revogar presenca alheia = mesmo erro');

-- responsible instructor validates and revokes ---------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.attendances), 1, 'instrutor responsavel ve as presencas da aula');
select is((select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d1', '88888888-8888-8888-8888-888888888888')), 'validated', 'instrutor responsavel valida');
select is((select validated_by from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d1'), '00000000-0000-0000-0000-0000000000c1'::uuid, 'validador registrado');
select is((select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d1', '88888888-8888-8888-8888-888888888888')), 'validated', 'validacao idempotente');
select throws_ok($$select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d2', '88888888-8888-8888-8888-888888888888')$$, '22023', null, 'mesma chave para outro aluno = VALIDATION_ERROR');
select throws_ok($$select public.revoke_attendance((select id from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d1'), 'x')$$, '22023', null, 'revogar exige justificativa');
select lives_ok($$select public.revoke_attendance((select id from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d1'), 'lancada por engano')$$, 'instrutor revoga com justificativa');
select is((select status from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d1'), 'revoked', 'presenca revogada');
select lives_ok($$select public.revoke_attendance((select id from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d1'), 'lancada por engano')$$, 'revogar de novo e idempotente');
select throws_ok($$select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d1', gen_random_uuid())$$, '23505', null, 'presenca revogada nao volta a ser validada');

-- direct registration by the teacher
select is((select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d2', gen_random_uuid())), 'validated', 'professor registra presenca de quem nao pediu');
select is((select source from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d2'), 'teacher', 'origem registrada como professor');
select throws_ok($$select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d5', gen_random_uuid())$$, '22023', null, 'nao valida quem esta com filiacao pendente');
select throws_ok($$select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000e1', gen_random_uuid())$$, '22023', null, 'nao valida quem nao e membro');
select throws_ok($$select public.validate_attendance('00000000-0000-0000-0000-000000005a04', '00000000-0000-0000-0000-0000000000d3', gen_random_uuid())$$, '22023', null, 'nao valida em aula cancelada');

-- QR: token creates a PENDING request only ---------------------------------------------------------
select set_config('test.token', (select token from public.create_check_in_token('00000000-0000-0000-0000-000000005a01')), true);
select is(length(current_setting('test.token')), 64, 'token aleatorio de 64 caracteres');
select throws_ok($$select * from public.create_check_in_token('00000000-0000-0000-0000-000000005a02')$$, '22023', null, 'nao gera QR para aula fora da janela');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select lives_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01', current_setting('test.token'))$$, 'aluno pede check-in pelo QR');
select is((select status || '/' || source from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d3'), 'pending/qr', 'QR so cria pedido pendente: nao valida sozinho');
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01', 'token-invalido')$$, '22023', null, 'token invalido rejeitado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a05', current_setting('test.token'))$$, '22023', null, 'token de uma aula nao vale para outra');

reset role;
select is((select count(*)::int from public.check_in_tokens where token_hash = sha256(convert_to(current_setting('test.token'), 'UTF8'))), 1, 'so o hash do token e guardado');
update public.check_in_tokens set expires_at = now() - interval '1 minute';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01', current_setting('test.token'))$$, '22023', null, 'token expirado rejeitado');
select is((select count(*)::int from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d4'), 0, 'sem presenca criada com token expirado');

-- the teacher confirms the QR request; the training diary is NOT attendance
select lives_ok($$select public.save_training_log(null, now(), 'treino', '{}'::uuid[], gen_random_uuid())$$, 'aluno registra treino no diario');
select is((select count(*)::int from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d4'), 0, 'registro de treino nao gera presenca');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d3', gen_random_uuid())), 'validated', 'professor confirma o pedido feito pelo QR');

-- roster visibility via view_roster, then the manager removes the permissions
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 1, 'instrutor com view_roster le o nome de membros');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'), 0, 'e nao de quem nao e membro');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.attendances where session_id = '00000000-0000-0000-0000-000000005a01'), 3, 'gestor ve todas as presencas da academia');
select lives_ok($$select public.set_instructor_permission('00000000-0000-0000-0000-00000000ac01', 'validate_attendance', false)$$, 'gestor retira a permissao de validar');
select lives_ok($$select public.set_instructor_permission('00000000-0000-0000-0000-00000000ac01', 'view_roster', false)$$, 'gestor retira a permissao de ver a lista');
select is((select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d4', gen_random_uuid())), 'validated', 'gestor continua validando');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d2', gen_random_uuid())$$, '42501', null, 'sem a permissao o instrutor responsavel nao valida mais');
select is((select count(*)::int from public.attendances), 0, 'nem le as presencas da aula');
select is((select count(*)::int from public.profiles), 1, 'sem view_roster e sem poder validar, le so o proprio perfil');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.set_instructor_permission('00000000-0000-0000-0000-00000000ac01', 'validate_attendance', true)$$, 'gestor devolve so a permissao de validar');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 1, 'poder validar mostra o nome de quem tem presenca na aula');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000d5'), 0, 'mas nao o de quem nao tem presenca');

-- manager of another academy / admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.validate_attendance('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d2', gen_random_uuid())$$, '42501', null, 'gestor de outra academia nao valida');
select is((select count(*)::int from public.attendances where session_id = '00000000-0000-0000-0000-000000005a01'), 0, 'nem le');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.attendances where session_id = '00000000-0000-0000-0000-000000005a01'), 4, 'super admin le tudo');
select ok((select count(*) from public.audit_events where action in ('attendance.request', 'attendance.validate', 'attendance.revoke', 'check_in_token.create')) >= 8, 'operacoes auditadas');
select is((select count(*)::int from public.audit_events where metadata::text like '%' || current_setting('test.token') || '%'), 0, 'o token nunca aparece na auditoria');

select * from finish();
rollback;
