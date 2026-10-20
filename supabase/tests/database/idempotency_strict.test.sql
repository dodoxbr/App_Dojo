-- Same idempotency key, same target, DIFFERENT decision must be rejected (not answered with the old result).
begin;
select plan(4);

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test'),
 ('00000000-0000-0000-0000-0000000000d1', 'aluno@example.test'),
 ('00000000-0000-0000-0000-0000000000d2', 'aluno2@example.test');
-- the fixtures are adults (age gate, migration 019)
insert into public.profile_private (user_id, birth_date) select id, date '1990-01-01' from auth.users where email like '%@example.test' on conflict (user_id) do nothing;
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'idem-um', '00000000-0000-0000-0000-0000000000b1');
insert into public.memberships (id, academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'pending'),
 ('00000000-0000-0000-0000-0000000000ac', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'approved');
insert into public.curricula (id, academy_id, title) values ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-00000000ac01', 'Trilha');
insert into public.curriculum_items (academy_id, curriculum_id, technique_id)
  select '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c9', id from public.techniques where name = 'Tesoura' and academy_id is null;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select is((select public.decide_membership('00000000-0000-0000-0000-0000000000ab', 'approved', null, '55555555-5555-5555-5555-555555555555')), 'approved', 'decide_membership: primeira decisao');
select throws_ok($$select public.decide_membership('00000000-0000-0000-0000-0000000000ab', 'rejected', null, '55555555-5555-5555-5555-555555555555')$$, '22023', null, 'decide_membership: mesma chave com decisao oposta = VALIDATION_ERROR');

select is((select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'studied', null, '66666666-6666-6666-6666-666666666666')), 'studied', 'assess_skill: primeira avaliacao');
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated', null, '66666666-6666-6666-6666-666666666666')$$, '22023', null, 'assess_skill: mesma chave com status diferente = VALIDATION_ERROR');

select * from finish();
rollback;
