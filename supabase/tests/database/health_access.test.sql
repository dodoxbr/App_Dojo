-- Health notes and emergency contact visible to the teacher (owner decision). Synthetic data only.
begin;
select plan(21);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a2', 'gestor2@example.test', '{"display_name":"Gestor Dois","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a9', 'admin@example.test', '{"display_name":"Super Admin","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000c1', 'prof@example.test', '{"display_name":"Professor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b3', 'aluno3@example.test', '{"display_name":"Aluno Tres","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'menor@example.test', jsonb_build_object('display_name', 'Menor Um', 'birth_date', (current_date - interval '9 years')::date::text, 'dependent', true));
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a9');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'saude-um', '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'saude-dois', '00000000-0000-0000-0000-0000000000a2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000a2', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved');
-- b1 and the minor have health notes; b2 has none; b3 has notes but his attendance was revoked
insert into public.profile_contacts (user_id, full_name, phone, postal_code, street, number, neighborhood, city, state,
                                     emergency_name, emergency_phone, emergency_relationship, health_notes, health_consent_at, updated_by)
select id, 'Pessoa de Teste', '11999990000', '01001000', 'Rua Ficticia', '1', 'Centro', 'Sao Paulo', 'SP',
       'Contato de Emergencia', '11977776666', 'mae',
       case when id = '00000000-0000-0000-0000-0000000000b2' then null else 'asma leve (dado de teste)' end,
       case when id = '00000000-0000-0000-0000-0000000000b2' then null else now() end, id
from auth.users where email in ('aluno1@example.test', 'aluno2@example.test', 'aluno3@example.test', 'menor@example.test');
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000ac01', 'Turma Teste', '00000000-0000-0000-0000-0000000000c1');
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at) values
 ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000e1', now() - interval '1 hour', now() + interval '1 hour');
insert into public.attendances (academy_id, session_id, user_id, status, source, validated_by, validated_at) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'validated', 'teacher', '00000000-0000-0000-0000-0000000000c1', now());
insert into public.attendances (academy_id, session_id, user_id, status, source) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1', 'pending', 'manual'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b2', 'pending', 'manual');
insert into public.attendances (academy_id, session_id, user_id, status, source, revoked_by, revoked_at, revoked_reason) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b3', 'revoked', 'manual', '00000000-0000-0000-0000-0000000000a1', now(), 'motivo de teste');

select is((select count(*)::int from public.academy_role_permissions where academy_id = '00000000-0000-0000-0000-00000000ac01' and permission = 'view_health'), 1, 'a permissao de ver saude vem ligada por padrao em academia nova');

set local role authenticated;

-- The teacher sees the notes (and the emergency contact) of the academy and of the people in the lesson
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_health_notes('00000000-0000-0000-0000-00000000ac01')), 3, 'professor ve as 3 pessoas da academia com observacao');
select is((select emergency_name from public.list_health_notes('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b1'), 'Contato de Emergencia', 'e o contato de emergencia');
select is((select is_minor from public.list_health_notes('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000d1'), true, 'a lista marca o menor');
select is((select count(*)::int from public.list_health_notes('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b2'), 0, 'quem nao tem observacao nao aparece');
select is((select count(*)::int from public.session_health_notes('00000000-0000-0000-0000-0000000000f1')), 2, 'na aula: so quem tem presenca pendente ou validada e observacao');
select is((select count(*)::int from public.session_health_notes('00000000-0000-0000-0000-0000000000f1') where user_id = '00000000-0000-0000-0000-0000000000b3'), 0, 'presenca revogada nao entra');
select is((select attendance_status from public.session_health_notes('00000000-0000-0000-0000-0000000000f1') where user_id = '00000000-0000-0000-0000-0000000000b1'), 'validated', 'mostra a situacao da presenca');

-- Nobody else
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select * from public.list_health_notes('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'aluno nao ve a lista (nem a propria)');
select throws_ok($$select * from public.session_health_notes('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'aluno nao ve a da aula');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$select * from public.list_health_notes('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'gestor de outra academia nao ve');
select throws_ok($$select * from public.session_health_notes('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'nem a aula de outra academia');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select * from public.list_health_notes('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'super admin nao ve dados de saude');
select throws_ok($$select * from public.session_health_notes('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'nem pela aula');

-- The manager sees, and controls whether the teacher does
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_health_notes('00000000-0000-0000-0000-00000000ac01')), 3, 'gestor ve');
select lives_ok($$select public.set_instructor_permission('00000000-0000-0000-0000-00000000ac01', 'view_health', false)$$, 'gestor desliga a permissao do professor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select * from public.list_health_notes('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'sem a permissao o professor deixa de ver');
select throws_ok($$select * from public.session_health_notes('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'tambem na aula');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.set_instructor_permission('00000000-0000-0000-0000-00000000ac01', 'view_health', true)$$, 'e liga de novo');

reset role;
select is((select count(*)::int from public.audit_events where action = 'health.view'), 8, 'cada consulta foi auditada');
select is((select count(*)::int from public.audit_events where action = 'health.view' and metadata::text like '%asma%'), 0, 'a auditoria nao guarda o conteudo das observacoes');

select * from finish();
rollback;
