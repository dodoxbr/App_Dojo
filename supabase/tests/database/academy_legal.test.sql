-- US-016b: company name and CNPJ of the academy (variables of the terms). Synthetic data only.
begin;
select plan(24);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a0', 'admin@example.test', '{"birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b0', 'criador@example.test', '{"birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000c0', 'comum@example.test', '{"birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000e0', 'outro@example.test', '{"birth_date":"1985-05-05"}');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a0');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Outra', 'legal-outra', '00000000-0000-0000-0000-0000000000e0');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e0', 'manager', 'approved');

-- CNPJ check digits (11.222.333/0001-81 is a well-known valid test number)
select is(public.is_valid_cnpj('11222333000181'), true, 'CNPJ valido');
select is(public.is_valid_cnpj('11222333000182'), false, 'digito verificador errado');
select is(public.is_valid_cnpj('11111111111111'), false, 'digitos repetidos');
select is(public.is_valid_cnpj('1122233300018'), false, 'tamanho errado');
select is(public.is_valid_cnpj(null), false, 'nulo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is((select public.grant_academy_creator('criador@example.test')), '00000000-0000-0000-0000-0000000000b0'::uuid, 'super admin libera o criador');

-- Creating an academy with its company data
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
select lives_ok($$select public.create_academy('Academia Legal', 'legal-um', 'Academia Legal Ltda (teste)', '11.222.333/0001-81', gen_random_uuid())$$, 'criador cria a academia com razao social e CNPJ');
select is((select cnpj from public.academies where slug = 'legal-um'), '11222333000181', 'CNPJ guardado so com digitos');
select is((select legal_name from public.academies where slug = 'legal-um'), 'Academia Legal Ltda (teste)', 'razao social guardada');
select throws_ok($$select public.create_academy('Academia Dois', 'legal-dois', 'Empresa Dois', '11.222.333/0001-80', gen_random_uuid())$$, '22023', null, 'CNPJ invalido nao cria nada');
select is((select count(*)::int from public.academies where slug = 'legal-dois'), 0, 'a academia nao foi criada');
select throws_ok($$select public.create_academy('Academia Tres', 'legal-tres', 'X', '11222333000181', gen_random_uuid())$$, '22023', null, 'razao social curta');

-- Editing later: only the manager of that academy (or the platform admin)
select lives_ok($$select public.set_academy_legal((select id from public.academies where slug = 'legal-um'), 'Nova Razao Social Ltda (teste)', '11222333000181')$$, 'gestor corrige os dados da empresa');
select is((select legal_name from public.academies where slug = 'legal-um'), 'Nova Razao Social Ltda (teste)', 'dado atualizado');
select throws_ok($$select public.set_academy_legal((select id from public.academies where slug = 'legal-um'), 'Empresa', '123')$$, '22023', null, 'CNPJ invalido na edicao');
select throws_ok($$select public.set_academy_legal('00000000-0000-0000-0000-00000000ac02', 'Empresa Alheia', '11222333000181')$$, '42501', null, 'gestor nao edita a empresa de outra academia');
select throws_ok($$update public.academies set cnpj = '11222333000181' where slug = 'legal-um'$$, '42501', null, 'sem UPDATE direto');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c0","role":"authenticated"}', true);
select throws_ok($$select public.set_academy_legal((select id from public.academies where slug = 'legal-um'), 'Empresa', '11222333000181')$$, '42501', null, 'usuario comum nao edita');
select throws_ok($$select public.create_academy('Academia Comum', 'legal-comum', 'Empresa Comum', '11222333000181', gen_random_uuid())$$, '42501', null, 'usuario comum nao cria academia');

-- Public data for the terms page of an academy (no sign-in)
reset role;
set local role anon;
select is((select legal_name from public.public_academy_legal('legal-um')), 'Nova Razao Social Ltda (teste)', 'a pagina de termos le a razao social sem login');
select is((select cnpj from public.public_academy_legal('LEGAL-UM')), '11222333000181', 'slug sem diferenciar maiusculas');
select is((select count(*)::int from public.public_academy_legal('nao-existe')), 0, 'slug inexistente: vazio');
select throws_ok($$select public.set_academy_legal('00000000-0000-0000-0000-00000000ac02', 'Empresa', '11222333000181')$$, '42501', null, 'anonimo nao edita');
reset role;
select is((select count(*)::int from public.audit_events where action = 'academy.legal' and academy_id = (select id from public.academies where slug = 'legal-um')), 1, 'a edicao da empresa foi auditada');

select * from finish();
rollback;
