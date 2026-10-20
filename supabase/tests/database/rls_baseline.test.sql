-- RLS baseline tests. Synthetic data only (fictitious ids/names).
begin;
select plan(14);

-- Fixtures (as postgres, bypass RLS)
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
 ('00000000-0000-0000-0000-0000000000b1', 'b@example.test'),
 ('00000000-0000-0000-0000-0000000000c1', 'c@example.test');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Teste 1', 'teste-1', '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Teste 2', 'teste-2', '00000000-0000-0000-0000-0000000000c1');
insert into public.memberships (academy_id, user_id, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'pending'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000c1', 'approved');
insert into public.techniques (id, academy_id, name, category) values
 ('00000000-0000-0000-0000-0000000000f0', null, 'Tecnica Global Teste', 'teste'),
 ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000ac01', 'Tecnica Ac1 Teste', 'teste'),
 ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000ac02', 'Tecnica Ac2 Teste', 'teste');
insert into public.training_logs (id, user_id, notes) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'diario privado A'),
 ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', 'diario privado B');

-- anon has no access
set local role anon;
select throws_ok($$select * from public.academies$$, '42501', null, 'anon nao le academias');

-- Acting as user A (approved, academy 1)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.training_logs), 1, 'A le apenas o proprio diario');
select is((select count(*)::int from public.techniques where name like 'Tecnica % Teste'), 2, 'A ve global + tecnicas da propria academia, nao da academia 2');
select throws_ok($$insert into public.memberships (academy_id,user_id,role,status) values ('00000000-0000-0000-0000-00000000ac02','00000000-0000-0000-0000-0000000000a1','manager','pending')$$, '42501', null, 'A nao se filia como manager');
select throws_ok($$insert into public.memberships (academy_id,user_id,status) values ('00000000-0000-0000-0000-00000000ac02','00000000-0000-0000-0000-0000000000a1','approved')$$, '42501', null, 'A nao se auto-aprova');
select throws_ok($$update public.memberships set role = 'manager'$$, '42501', null, 'A nao promove papel por UPDATE');
select throws_ok($$insert into public.academies (name,slug,owner_user_id) values ('Fake','fake','00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'A nao cria academia direto');
select throws_ok($$insert into public.training_logs (academy_id,user_id) values ('00000000-0000-0000-0000-00000000ac02','00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'A nao registra diario em academia onde nao e membro');
select throws_ok($$insert into public.training_logs (user_id) values ('00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'A nao cria diario em nome de B');
select throws_ok($$insert into public.training_log_techniques (log_id,technique_id) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f2')$$, '42501', null, 'A nao vincula tecnica de outra academia');
select is_empty($$update public.training_logs set notes = 'x' where id = '00000000-0000-0000-0000-0000000000d2' returning id$$, 'A nao altera diario de B');

-- Acting as user B (pending membership)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.techniques where name like 'Tecnica % Teste'), 1, 'Filiacao pendente nao concede tecnicas internas');
select is((select count(*)::int from public.memberships), 1, 'B ve apenas a propria filiacao');

-- Acting as user C (academy 2)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.techniques where academy_id = '00000000-0000-0000-0000-00000000ac01'), 0, 'C nao ve tecnicas da academia 1');

select * from finish();
rollback;
