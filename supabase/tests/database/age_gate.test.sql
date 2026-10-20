-- US-013 (part 1): age gate. Synthetic data only.
begin;
select plan(28);

-- Sign-ups through the real trigger (raw_user_meta_data carries the birth date from the form)
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test', '{"birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'adulto@example.test', jsonb_build_object('birth_date', (current_date - interval '30 years')::date::text)),
 ('00000000-0000-0000-0000-0000000000d2', 'justo18@example.test', jsonb_build_object('birth_date', (current_date - interval '18 years')::date::text)),
 ('00000000-0000-0000-0000-0000000000d3', 'quase18@example.test', jsonb_build_object('birth_date', (current_date - interval '18 years' + interval '1 day')::date::text)),
 ('00000000-0000-0000-0000-0000000000d4', 'crianca@example.test', jsonb_build_object('birth_date', (current_date - interval '9 years')::date::text)),
 ('00000000-0000-0000-0000-0000000000d5', 'semdata@example.test', '{}'),
 ('00000000-0000-0000-0000-0000000000d6', 'datafutura@example.test', jsonb_build_object('birth_date', (current_date + 10)::text)),
 ('00000000-0000-0000-0000-0000000000d7', 'lixo@example.test', '{"birth_date":"nao-e-data"}'),
 ('00000000-0000-0000-0000-0000000000d8', 'tardio@example.test', '{}');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'idade-um', '00000000-0000-0000-0000-0000000000b1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved');

-- What the sign-up trigger stored
select is((select count(*)::int from public.profile_private where user_id = '00000000-0000-0000-0000-0000000000d1'), 1, 'data de nascimento valida e guardada');
select is((select count(*)::int from public.profile_private where user_id in ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000d7')), 0, 'ausente, futura ou invalida: idade desconhecida (e o cadastro nao falha)');
select is((select count(*)::int from public.profiles where id in ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000d7')), 3, 'o perfil e criado mesmo assim');
select is(public.is_adult('00000000-0000-0000-0000-0000000000d1'), true, 'adulto');
select is(public.is_adult('00000000-0000-0000-0000-0000000000d2'), true, 'quem faz 18 anos hoje ja e adulto');
select is(public.is_adult('00000000-0000-0000-0000-0000000000d3'), false, 'falta 1 dia para os 18: ainda e menor');
select is(public.is_adult('00000000-0000-0000-0000-0000000000d4'), false, 'crianca nao e adulta');
select is(public.is_adult('00000000-0000-0000-0000-0000000000d5'), false, 'idade desconhecida nao conta como adulto');

set local role authenticated;

-- Privacy: the birth date is readable only by its owner; others only learn age status through the gate
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.profile_private), 1, 'o gestor so le a propria data de nascimento');
select throws_ok($$insert into public.profile_private (user_id, birth_date) values ('00000000-0000-0000-0000-0000000000d4', date '1990-01-01')$$, '42501', null, 'sem INSERT direto em profile_private');
select throws_ok($$update public.profile_private set birth_date = date '1990-01-01'$$, '42501', null, 'sem UPDATE direto em profile_private');
select throws_ok($$select public.is_adult('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'is_adult nao e chamavel por clientes');
select is((select public.my_age_status()), 'adult', 'my_age_status: adulto');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select is((select public.my_age_status()), 'minor', 'my_age_status: menor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}', true);
select is((select public.my_age_status()), 'unknown', 'my_age_status: desconhecido');
select is((select count(*)::int from public.profile_private), 0, 'ninguem le a data de outra pessoa');

-- Minors and unknown ages cannot enter an academy
select throws_ok($$select public.request_membership('00000000-0000-0000-0000-00000000ac01')$$, '22023', null, 'idade desconhecida nao solicita filiacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select throws_ok($$select public.request_membership('00000000-0000-0000-0000-00000000ac01')$$, '22023', null, 'crianca nao solicita filiacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select throws_ok($$select public.request_membership('00000000-0000-0000-0000-00000000ac01')$$, '22023', null, 'quem ainda nao fez 18 nao solicita filiacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select lives_ok($$select public.request_membership('00000000-0000-0000-0000-00000000ac01')$$, 'quem fez 18 anos solicita filiacao');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.add_member('00000000-0000-0000-0000-00000000ac01', 'crianca@example.test', 'student')$$, '22023', null, 'gestor nao cadastra crianca diretamente');
select throws_ok($$select public.add_member('00000000-0000-0000-0000-00000000ac01', 'semdata@example.test', 'student')$$, '22023', null, 'nem quem tem idade desconhecida');
select lives_ok($$select public.add_member('00000000-0000-0000-0000-00000000ac01', 'adulto@example.test', 'student')$$, 'gestor cadastra adulto');

-- A minor that somehow has a pending request (created before the gate) cannot be approved
reset role;
insert into public.memberships (id, academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d4', 'student', 'pending');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.decide_membership('00000000-0000-0000-0000-0000000000aa', 'approved', null, gen_random_uuid())$$, '22023', null, 'pedido antigo de menor nao pode ser aprovado');
select is((select public.decide_membership('00000000-0000-0000-0000-0000000000aa', 'rejected', 'menor de idade', gen_random_uuid())), 'rejected', 'mas pode ser rejeitado');

-- Old accounts without a birth date declare it once; it never changes afterwards
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d8","role":"authenticated"}', true);
select throws_ok($$select public.set_my_birth_date(current_date + 1)$$, '22023', null, 'data futura rejeitada');
select lives_ok($$select public.set_my_birth_date((current_date - interval '25 years')::date)$$, 'conta antiga declara a data uma unica vez');
select throws_ok($$select public.set_my_birth_date((current_date - interval '40 years')::date)$$, '23505', null, 'e nao pode alterar depois');

select * from finish();
rollback;
