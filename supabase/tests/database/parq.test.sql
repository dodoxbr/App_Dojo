-- PAR-Q (migration 042): resposta, privacidade, alerta, validade e consulta auditada. Dados sintéticos.
begin;
select plan(22);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000c1', 'prof@example.test', '{"display_name":"Professor Um","birth_date":"1988-08-08"}'),
 ('00000000-0000-0000-0000-0000000000c2', 'prof2@example.test', '{"display_name":"Professor Dois","birth_date":"1989-09-09"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1991-01-01"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'resp1@example.test', '{"display_name":"Resp Um","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'menor1@example.test', jsonb_build_object('display_name', 'Menor Um', 'birth_date', (current_date - interval '9 years')::date::text, 'dependent', true));
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'pq-um', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c2', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved');
insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae');
-- o professor 1 pode ver saude; o professor 2 nao
insert into public.academy_role_permissions (academy_id, role, permission) values ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'view_health')
  on conflict do nothing;

set local role authenticated;

-- 1. A pessoa responde: tudo "nao" = sem alerta; qualquer "sim" = alerta
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.submit_parq('00000000-0000-0000-0000-0000000000b1', '{false,false,false}', null, decode('89504e47' || repeat('00', 300), 'hex'), repeat('a', 64), '203.0.113.9', 'Navegador de teste')$$, '22023', null, 'sao 7 perguntas');
select throws_ok($$select public.submit_parq('00000000-0000-0000-0000-0000000000b1', array[false,false,false,false,false,false,false], null, '02'::bytea, repeat('a', 64), '203.0.113.9', 'x')$$, '22023', null, 'a assinatura precisa ser uma imagem PNG');
select lives_ok($$select public.submit_parq('00000000-0000-0000-0000-0000000000b1', array[false,false,false,false,false,false,false], null, decode('89504e47' || repeat('00', 300), 'hex'), repeat('a', 64), '203.0.113.9', 'Navegador de teste')$$, 'responde tudo nao');
select is((select has_flag from public.my_parq('00000000-0000-0000-0000-0000000000b1')), false, 'sem alerta');
select lives_ok($$select public.submit_parq('00000000-0000-0000-0000-0000000000b1', array[false,false,false,false,true,false,false], 'joelho operado (teste)', decode('89504e47' || repeat('00', 300), 'hex'), repeat('a', 64), '203.0.113.9', 'Navegador de teste')$$, 'nova resposta com um sim');
select is((select has_flag from public.my_parq('00000000-0000-0000-0000-0000000000b1')), true, 'o ultimo registro tem alerta');
select is((select expired from public.my_parq('00000000-0000-0000-0000-0000000000b1')), false, 'e esta dentro da validade');

-- 2. Privacidade: outro aluno nao responde nem le pelos outros
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select public.submit_parq('00000000-0000-0000-0000-0000000000b1', array[false,false,false,false,false,false,false], null, decode('89504e47' || repeat('00', 300), 'hex'), repeat('a', 64), '203.0.113.9', 'Navegador de teste')$$, '42501', null, 'ninguem responde pelo outro adulto');
select throws_ok($$select public.my_parq('00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'nem le o PAR-Q do colega');
select throws_ok($$select public.list_parq_status('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'aluno nao ve a lista da academia');

-- 3. O responsavel responde pelo menor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select lives_ok($$select public.submit_parq('00000000-0000-0000-0000-0000000000d1', array[false,false,false,false,false,false,false], null, decode('89504e47' || repeat('00', 300), 'hex'), repeat('a', 64), '203.0.113.9', 'Navegador de teste')$$, 'o responsavel responde pelo menor');
select is((select count(*)::int from public.my_parq('00000000-0000-0000-0000-0000000000d1')), 1, 'e le a resposta do menor');

-- 4. Quem pode ver saude ve a situacao e, com auditoria, as respostas
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select has_flag from public.list_parq_status('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b1'), true, 'o gestor ve que o aluno 1 esta em atencao');
select is((select answered_at is null from public.list_parq_status('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b2'), true, 'e que o aluno 2 ainda nao respondeu');
select is((select notes from public.parq_detail('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')), 'joelho operado (teste)', 'o gestor le as respostas');
select is((select count(*)::int from public.audit_events where action = 'parq.view' and entity_id = '00000000-0000-0000-0000-0000000000b1'), 1, 'e a consulta fica registrada');
select throws_ok($$select public.parq_detail('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000f9')$$, '42501', null, 'so de quem e membro da academia');

-- 5. Atestado medico: quem tem a permissao marca que conferiu; o detalhe guarda as evidencias da assinatura
select lives_ok($$select public.mark_medical_certificate('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')$$, 'o gestor marca que conferiu o atestado');
select is((select certificate_checked from public.list_parq_status('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b1'), true, 'e a lista mostra o atestado conferido');
select throws_ok($$select public.mark_medical_certificate('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2')$$, '22023', null, 'so marca atestado de quem teve alerta');
select is((select client_ip || ' | ' || user_agent from public.parq_detail('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')), '203.0.113.9 | Navegador de teste', 'o detalhe guarda o IP e o navegador informados');
select is((select length(term_hash) from public.parq_detail('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')), 64, 'e o hash do texto do termo');

select * from finish();
rollback;
