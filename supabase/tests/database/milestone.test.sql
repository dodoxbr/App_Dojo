-- US-020: aviso quando o aluno chega a 30 treinos desde a última graduação. Dados sintéticos.
begin;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a9', 'admin@example.test', '{"display_name":"Super Admin","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000c1', 'prof@example.test', '{"display_name":"Professor Com Permissao","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000c2', 'prof2@example.test', '{"display_name":"Professor Sem Permissao","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Trinta","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Vinte e Nove","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b3', 'aluno3@example.test', '{"display_name":"Aluno Sem Faixa","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'resp@example.test', '{"display_name":"Resp Legal","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000e2', 'outro@example.test', '{"display_name":"Outro Responsavel","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000f1', 'externo@example.test', '{"display_name":"Externo","birth_date":"1981-01-01"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'menor1@example.test', jsonb_build_object('display_name', 'Menor Trinta', 'birth_date', (current_date - interval '9 years')::date::text, 'dependent', true));
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a9');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'mt-um', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c2', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved');
insert into public.academy_role_permissions (academy_id, role, permission) values
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'recommend_graduation'),
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'view_health')
 on conflict do nothing;
-- c2 é só gestor de OUTRA academia (não pode ver esta).
delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000000c2';
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'mt-dois', '00000000-0000-0000-0000-0000000000c2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000c2', 'manager', 'approved');
insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae');
insert into public.guardian_consents (academy_id, minor_user_id, guardian_user_id, status, verified_by, verified_at, document_checked, consent_photos, consent_text_version) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, false, 'rascunho-2026-11');
-- Saúde do aluno 1 (com consentimento)
insert into public.profile_contacts (user_id, full_name, phone, postal_code, street, number, neighborhood, city, state, emergency_name, emergency_phone, emergency_relationship, health_notes, health_consent_at, updated_by)
  values ('00000000-0000-0000-0000-0000000000b1', 'Aluno Trinta', '11999990000', '01001000', 'Rua Ficticia', '1', 'Centro', 'Sao Paulo', 'SP', 'Contato', '11977776666', 'mae', 'alergia de teste', now(), '00000000-0000-0000-0000-0000000000b1');
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-00000000ac01', 'Turma Marco', '00000000-0000-0000-0000-0000000000a1');
-- 40 aulas passadas, uma por dia (dias -41 a -2)
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at)
  select ('00000000-0000-0000-0000-00000000' || lpad(k::text, 4, '0'))::uuid, '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b9',
         now() - make_interval(days => k + 1), now() - make_interval(days => k + 1) + interval '1 hour'
  from generate_series(1, 40) k;
-- Aluno 1: presença validada nas aulas 1 a 30 (dias -2 a -31); aluno 2: nas aulas 1 a 29; aluno 3: 1 a 30 mas a 30ª REVOGADA; menor: 1 a 30
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
  select '00000000-0000-0000-0000-00000000ac01', ('00000000-0000-0000-0000-00000000' || lpad(k::text, 4, '0'))::uuid, u.id, 'teacher', 'validated', '00000000-0000-0000-0000-0000000000a1', now()
  from generate_series(1, 30) k cross join (values ('00000000-0000-0000-0000-0000000000b1'::uuid), ('00000000-0000-0000-0000-0000000000d1'::uuid)) u(id);
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
  select '00000000-0000-0000-0000-00000000ac01', ('00000000-0000-0000-0000-00000000' || lpad(k::text, 4, '0'))::uuid, '00000000-0000-0000-0000-0000000000b2', 'teacher', 'validated', '00000000-0000-0000-0000-0000000000a1', now()
  from generate_series(1, 29) k;
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
  select '00000000-0000-0000-0000-00000000ac01', ('00000000-0000-0000-0000-00000000' || lpad(k::text, 4, '0'))::uuid, '00000000-0000-0000-0000-0000000000b3', 'teacher', 'validated', '00000000-0000-0000-0000-0000000000a1', now()
  from generate_series(1, 29) k;
insert into public.attendances (academy_id, session_id, user_id, source, status, revoked_by, revoked_at, revoked_reason) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-0000000000b3', 'teacher', 'revoked', '00000000-0000-0000-0000-0000000000a1', now(), 'engano de teste');
-- Graduação do aluno 1 ANTES de todas as aulas (dia -60); aluno 2 também; aluno 3 sem faixa registrada
insert into public.promotions (academy_id, user_id, belt_code, degree, event_type, effective_date, created_by)
  select '00000000-0000-0000-0000-00000000ac01', u, 'Faixa Teste A', 0, 'initial', current_date - 60, '00000000-0000-0000-0000-0000000000a1'
  from unnest(array['00000000-0000-0000-0000-0000000000b1'::uuid, '00000000-0000-0000-0000-0000000000b2'::uuid, '00000000-0000-0000-0000-0000000000d1'::uuid]) u;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- 1. O aluno vê o próprio aviso
select is((select attendances from public.my_milestones()), 30, 'o aluno com 30 presenças recebe o aviso');
select is((select belt_code from public.my_milestones()), 'Faixa Teste A', 'com a faixa atual');
select is((select count(*)::int from public.my_milestones()), 1, 'um aviso só (uma academia)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.my_milestones()), 0, '29 presenças: ainda sem aviso');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select is((select count(*)::int from public.my_milestones()), 0, '29 validadas e 1 revogada: sem aviso (e sem faixa a contagem vai desde o começo)');

-- 2. O responsável vê o aviso do filho; outras pessoas não
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select attendances from public.dependent_milestones('00000000-0000-0000-0000-0000000000d1')), 30, 'o responsável vê o aviso do filho');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select throws_ok($$select * from public.dependent_milestones('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'outro responsável não vê');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select * from public.dependent_milestones('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'outro membro não vê');

-- 3. O professor com permissão vê a lista e o perfil
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_milestone_students('00000000-0000-0000-0000-00000000ac01')), 2, 'a lista tem os dois que chegaram a 30 (adulto e menor)');
select is((select person_name from public.list_milestone_students('00000000-0000-0000-0000-00000000ac01') where not is_minor), 'Aluno Trinta', 'quem é');
select is((select is_minor from public.list_milestone_students('00000000-0000-0000-0000-00000000ac01') where person_name = 'Menor Trinta'), true, 'e se é menor');
select is((select students from public.my_staff_milestones() where academy_id = '00000000-0000-0000-0000-00000000ac01'), 2, 'o aviso do professor conta 2 alunos');
select is((select attendances from public.student_milestone_summary('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')), 30, 'o perfil mostra as presenças desde a última graduação');
select is((select belt_code from public.student_milestone_summary('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')), 'Faixa Teste A', 'a faixa');
select is((select health_notes from public.student_milestone_summary('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')), 'alergia de teste', 'e a saúde, porque ele tem a permissão de ver saúde');
reset role;
select cmp_ok((select count(*)::int from public.audit_events where action = 'health.view' and metadata->>'scope' = 'person'), '>=', 1, 'a leitura da saúde foi auditada (uma por consulta)');
select is((select count(*)::int from public.audit_events where metadata::text like '%alergia%'), 0, 'sem guardar o texto na auditoria');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select * from public.student_milestone_summary('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000f1')$$, 'P0002', null, 'quem não é aluno da academia: não encontrado');

-- 4. Sem permissão, não vê
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select * from public.list_milestone_students('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'quem é de fora não vê a lista');
select throws_ok($$select * from public.student_milestone_summary('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'nem o perfil');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$select * from public.list_milestone_students('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'gestor de outra academia não vê');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select * from public.list_milestone_students('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'super admin não vê a lista');
select is((select count(*)::int from public.my_staff_milestones()), 0, 'nem o aviso do lado da academia');
select throws_ok($$select public.attendances_since_rank('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'a função interna não é chamável');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_milestone_students('00000000-0000-0000-0000-00000000ac01')), 2, 'o gestor vê a lista');

-- 5. Uma nova graduação zera a contagem; presença revogada tira do marco
reset role;
insert into public.promotions (academy_id, user_id, belt_code, degree, event_type, effective_date, created_by)
  values ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'Faixa Teste A', 1, 'promotion', current_date, '00000000-0000-0000-0000-0000000000a1');
update public.attendances set status = 'revoked', validated_by = null, validated_at = null, revoked_by = '00000000-0000-0000-0000-0000000000a1', revoked_at = now(), revoked_reason = 'engano de teste'
  where user_id = '00000000-0000-0000-0000-0000000000d1' and session_id = '00000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.my_milestones()), 0, 'nova graduação: o aviso some e a contagem recomeça');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_milestone_students('00000000-0000-0000-0000-00000000ac01')), 0, 'o menor caiu para 29 e o adulto zerou: lista vazia');

select * from finish();
rollback;
