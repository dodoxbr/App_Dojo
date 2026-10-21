-- US-004: membership flow. Synthetic data only.
begin;
select plan(42);

-- Fixtures (as postgres)
-- a1 manager ac01 | m2 manager ac02 | i1 instructor ac01 | s1 requester | r1 rejected | e1 ended | s2 other | x1 unrelated
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test'),
 ('00000000-0000-0000-0000-0000000000b2', 'gestor2@example.test'),
 ('00000000-0000-0000-0000-0000000000c1', 'instrutor@example.test'),
 ('00000000-0000-0000-0000-0000000000d1', 'aluno1@example.test'),
 ('00000000-0000-0000-0000-0000000000d2', 'aluno2@example.test'),
 ('00000000-0000-0000-0000-0000000000d3', 'rejeitado@example.test'),
 ('00000000-0000-0000-0000-0000000000d4', 'encerrado@example.test'),
 ('00000000-0000-0000-0000-0000000000f1', 'semvinculo@example.test');
-- the fixtures are adults (age gate, migration 019)
insert into public.profile_private (user_id, birth_date) select id, date '1990-01-01' from auth.users where email like '%@example.test' on conflict (user_id) do nothing;
insert into public.profile_contacts (user_id, full_name, phone, postal_code, street, number, neighborhood, city, state, emergency_name, emergency_phone, emergency_relationship, updated_by) select id, 'Pessoa de Teste', '11999990000', '01001000', 'Rua Ficticia', '1', 'Centro', 'Sao Paulo', 'SP', 'Contato de Emergencia', '11977776666', 'mae', id from auth.users where email like '%@example.test' on conflict (user_id) do nothing;
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'academia-um', '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'academia-dois', '00000000-0000-0000-0000-0000000000b2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000b2', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'student', 'rejected'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d4', 'student', 'ended'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000d2', 'student', 'pending');
insert into public.techniques (academy_id, name, category) values
 ('00000000-0000-0000-0000-00000000ac01', 'Tecnica Interna Um', 'teste');

set local role authenticated;

-- s1 requests membership
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok($$select public.request_membership('00000000-0000-0000-0000-00000000ac01')$$, 's1 solicita filiacao');
select is((select status::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'pending', 'nasce pendente');
select is((select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'student', 'como aluno');
select is((select public.request_membership('00000000-0000-0000-0000-00000000ac01')),
          (select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'solicitar de novo e idempotente');
select is((select count(*)::int from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 1, 'sem vinculo duplicado');
select throws_ok($$select public.request_membership(gen_random_uuid())$$, 'P0002', null, 'academia inexistente = NOT_FOUND');
select throws_ok($$insert into public.memberships (academy_id, user_id) values ('00000000-0000-0000-0000-00000000ac02','00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'sem INSERT direto em memberships');
select throws_ok($$update public.memberships set status = 'approved'$$, '42501', null, 'sem UPDATE direto em memberships');
select is((select count(*)::int from public.techniques where academy_id = '00000000-0000-0000-0000-00000000ac01'), 0, 'pendente nao le tecnicas internas');
select throws_ok($$select public.decide_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'approved', null, gen_random_uuid())$$, '42501', null, 'aluno nao aprova a si mesmo');

-- rejected / ended
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select throws_ok($$select public.request_membership('00000000-0000-0000-0000-00000000ac01')$$, '23505', null, 'rejeitado nao pede de novo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select lives_ok($$select public.request_membership('00000000-0000-0000-0000-00000000ac01')$$, 'encerrado pode pedir de novo');
select is((select status::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d4'), 'pending', 'volta a pendente');

-- not authorized to decide / add / end
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.decide_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'approved', null, gen_random_uuid())$$, '42501', null, 'instrutor nao decide');
select throws_ok($$select public.add_member('00000000-0000-0000-0000-00000000ac01', 'aluno2@example.test', 'student')$$, '42501', null, 'instrutor nao cadastra');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select public.decide_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'approved', null, gen_random_uuid())$$, '42501', null, 'gestor de outra academia nao decide');
select throws_ok($$select public.decide_membership(gen_random_uuid(), 'approved', null, gen_random_uuid())$$, '42501', null, 'id inexistente tem o mesmo erro (nao revela existencia)');
select throws_ok($$select public.end_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000c1'), null)$$, '42501', null, 'gestor de outra academia nao encerra');

-- manager decides
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.decide_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'maybe', null, gen_random_uuid())$$, '22023', null, 'decisao invalida');
select is((select public.decide_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'approved', 'ok', '22222222-2222-2222-2222-222222222222')), 'approved', 'gestor aprova');
select is((select reviewed_by from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'revisor registrado');
select is((select public.decide_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'approved', 'ok', '22222222-2222-2222-2222-222222222222')), 'approved', 'mesma chave = mesmo resultado');
select throws_ok($$select public.decide_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'rejected', null, gen_random_uuid())$$, '23505', null, 'ja decidido = CONFLICT');
select throws_ok($$select public.decide_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d4'), 'approved', null, '22222222-2222-2222-2222-222222222222')$$, '22023', null, 'mesma chave em outro vinculo = VALIDATION_ERROR');
select is((select public.decide_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d4'), 'rejected', 'sem vaga', gen_random_uuid())), 'rejected', 'gestor rejeita');
select is((select count(*)::int from public.audit_events where action = 'membership.decide'), 2, 'decisoes auditadas (sem duplicar a repetida)');

-- approved student now sees internal data
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.techniques where academy_id = '00000000-0000-0000-0000-00000000ac01'), 1, 'aprovado le tecnicas internas');

-- manager registers people directly
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.add_member('00000000-0000-0000-0000-00000000ac01', 'Aluno2@Example.Test', 'instructor')$$, 'gestor cadastra colaborador por e-mail');
select is((select role::text || '/' || status::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d2' and academy_id = '00000000-0000-0000-0000-00000000ac01'), 'instructor/approved', 'colaborador aprovado');
select throws_ok($$select public.add_member('00000000-0000-0000-0000-00000000ac01', 'naoexiste@example.test', 'student')$$, 'P0002', null, 'e-mail sem conta = NOT_FOUND');
select throws_ok($$select public.add_member('00000000-0000-0000-0000-00000000ac01', 'aluno1@example.test', 'manager')$$, '22023', null, 'nao cadastra gestor');
select throws_ok($$select public.add_member('00000000-0000-0000-0000-00000000ac01', 'gestor@example.test', 'student')$$, '23505', null, 'nao altera vinculo de gestor');
select is((select public.add_member('00000000-0000-0000-0000-00000000ac01', 'aluno1@example.test', 'instructor')),
          (select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'aluno aprovado vira colaborador (mesmo vinculo)');
select is((select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'instructor', 'papel alterado');

-- ending
select lives_ok($$select public.end_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'saiu da academia')$$, 'gestor encerra vinculo');
select is((select status::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1'), 'ended', 'vinculo encerrado');
select throws_ok($$select public.end_membership((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a1' and academy_id = '00000000-0000-0000-0000-00000000ac01'), null)$$, '23505', null, 'gestor nao e encerrado');

-- display names
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 1, 'gestor le o nome de quem tem vinculo com a academia');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 0, 'gestor nao le o perfil de quem nao tem vinculo');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.techniques where academy_id = '00000000-0000-0000-0000-00000000ac01'), 0, 'encerrado perde acesso interno');
select is((select count(*)::int from public.profiles), 1, 'aluno le so o proprio perfil');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles), 1, 'instrutor le so o proprio perfil');

select * from finish();
rollback;
