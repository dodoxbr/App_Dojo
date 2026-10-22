-- PAR-Q obrigatório por academia (migration 045): vencido ou ausente bloqueia o check-in; responder de novo libera. Dados sintéticos.
begin;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000c1', 'prof@example.test', '{"display_name":"Professor Um","birth_date":"1988-08-08"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000d2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1991-01-01"}');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'pb-um', '00000000-0000-0000-0000-0000000000b1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'approved');
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-00000000ac01', 'Turma Um', '00000000-0000-0000-0000-0000000000c1');
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at, status) values
 ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c9', now() - interval '10 minutes', now() + interval '50 minutes', 'scheduled');

set local role authenticated;

-- 1. Desligado (padrão): sem PAR-Q, o check-in passa
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01')$$, 'com o bloqueio desligado, o check-in passa mesmo sem PAR-Q');
select is((select count(*)::int from public.my_parq_blocks()), 0, 'e nao ha aviso de bloqueio');

-- 2. So o gestor liga
select throws_ok($$select public.set_parq_required('00000000-0000-0000-0000-00000000ac01', true)$$, '42501', null, 'aluno nao liga o bloqueio');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.set_parq_required('00000000-0000-0000-0000-00000000ac01', true)$$, 'o gestor liga o bloqueio');

-- 3. Ligado: quem nunca respondeu e bloqueado
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01')$$, '22023', null, 'sem PAR-Q: check-in bloqueado');
select is((select reason from public.my_parq_blocks()), 'missing', 'o aviso diz que nunca respondeu');

-- 4. Responder libera na hora
select lives_ok($$select public.submit_parq('00000000-0000-0000-0000-0000000000d2', array[false,false,false,false,false,false,false], null, decode('89504e47' || repeat('00', 300), 'hex'), repeat('a', 64), '203.0.113.9', 'Teste')$$, 'responde o PAR-Q');
select lives_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01')$$, 'e o check-in libera');

-- 5. Vencido (mais de 12 meses) bloqueia; responder de novo libera
reset role;
update public.parq_responses set created_at = now() - interval '400 days' where user_id = '00000000-0000-0000-0000-0000000000d2';
delete from public.attendances where user_id = '00000000-0000-0000-0000-0000000000d2';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select throws_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01')$$, '22023', null, 'PAR-Q vencido: check-in bloqueado');
select is((select reason from public.my_parq_blocks()), 'expired', 'o aviso diz que venceu');
select lives_ok($$select public.submit_parq('00000000-0000-0000-0000-0000000000d2', array[false,false,false,false,false,false,false], null, decode('89504e47' || repeat('00', 300), 'hex'), repeat('b', 64), '203.0.113.9', 'Teste')$$, 'responde de novo');
select lives_ok($$select public.request_check_in('00000000-0000-0000-0000-000000005a01')$$, 'volta a liberar');
select is((select count(*)::int from public.my_parq_blocks()), 0, 'sem aviso de bloqueio');

select * from finish();
rollback;
