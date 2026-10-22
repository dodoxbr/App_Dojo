-- Pacotes por academia: funcionalidades ligadas/desligadas e a barreira no banco. Dados sintéticos.
begin;
select plan(29);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a9', 'admin@example.test', '{"display_name":"Super Admin","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000f1', 'externo@example.test', '{"display_name":"Externo","birth_date":"1981-01-01"}');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a9');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'pl-um', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved');
create temp table pics as select decode('ffd8ffe000104a46494600010100000100010000', 'hex') as ok;
grant select on pics to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- 1. Catálogo, pacotes e leitura
select is((select count(*)::int from public.feature_catalog()), 7, 'o catalogo tem 7 funcionalidades opcionais');
select is((select count(*)::int from public.plans), 3, 'tres pacotes iniciais');
select is((select plan_code from public.academies where id = '00000000-0000-0000-0000-00000000ac01'), 'avancado', 'uma academia nova comeca no pacote avancado (tudo ligado)');
select is((select cardinality(public.academy_features('00000000-0000-0000-0000-00000000ac01'))), 7, 'o gestor ve as 7 funcionalidades ligadas');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select cardinality(public.academy_features('00000000-0000-0000-0000-00000000ac01'))), 7, 'o aluno tambem ve');
select is((select count(*)::int from public.my_academy_features()), 1, 'my_academy_features lista a academia do aluno');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.academy_features('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'quem e de fora nao ve as funcionalidades');
select is((select count(*)::int from public.my_academy_features()), 0, 'e nao tem academias na lista');

-- 2. Só o super admin escolhe o pacote
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.set_academy_plan('00000000-0000-0000-0000-00000000ac01', 'inicial')$$, '42501', null, 'o gestor nao escolhe o proprio pacote');
select throws_ok($$select public.update_plan_features('avancado', '{finance}')$$, '42501', null, 'o gestor nao edita pacotes');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select public.set_academy_plan('00000000-0000-0000-0000-00000000ac01', 'nao_existe')$$, '22023', null, 'pacote inexistente');
select lives_ok($$select public.set_academy_plan('00000000-0000-0000-0000-00000000ac01', 'inicial')$$, 'o super admin coloca a academia no pacote inicial');
select is((select cardinality(public.academy_features('00000000-0000-0000-0000-00000000ac01'))), 0, 'agora sem nenhuma funcionalidade opcional');

-- 3. Com o pacote inicial, criar dado das funcionalidades desligadas e barrado no banco (erro 0A000)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.create_charge('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'Taxa (teste)', 1000, current_date, gen_random_uuid())$$, '0A000', null, 'financeiro desligado: cobranca barrada');
select throws_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 10000, 10, current_date, true, 0, null)$$, '0A000', null, 'financeiro desligado: plano barrado');
select throws_ok($$select public.create_curriculum('00000000-0000-0000-0000-00000000ac01', 'Trilha (teste)', null, gen_random_uuid())$$, '0A000', null, 'trilhas desligadas: curriculo barrado');
select throws_ok($$select public.set_my_milestone_setting('00000000-0000-0000-0000-00000000ac01', 20, true)$$, '0A000', null, 'aviso de treinos desligado: configuracao barrada');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'foto (teste)', (select ok from pics), 100, 100, false, '{}', gen_random_uuid())$$, '0A000', null, 'feed desligado: postagem barrada');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'Desafio (teste)', null, 'training', 5, null, null, (now() at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date + 5, 3, true, gen_random_uuid())$$, '0A000', null, 'desafios desligados: criacao barrada');

-- 4. Voltando ao pacote avançado, tudo funciona de novo; apagar e moderar sempre funcionam
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select lives_ok($$select public.set_academy_plan('00000000-0000-0000-0000-00000000ac01', 'avancado')$$, 'de volta ao pacote avancado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 10000, 10, current_date, true, 0, null)$$, 'financeiro ligado: plano permitido');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'foto (teste)', (select ok from pics), 100, 100, false, '{}', '99999999-9999-9999-9999-999999999999')$$, 'feed ligado: postagem permitida');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select public.set_academy_plan('00000000-0000-0000-0000-00000000ac01', 'inicial');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.delete_feed_post((select id from public.feed_posts limit 1))$$, 'com o feed desligado o autor ainda apaga a propria foto');

-- 5. Editar o que um pacote inclui
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select public.update_plan_features('inicial', '{finance,inexistente}')$$, '22023', null, 'funcionalidade fora do catalogo');
select lives_ok($$select public.update_plan_features('inicial', '{finance,finance,medals}')$$, 'o super admin inclui funcionalidades no pacote inicial (sem repetir)');
select is((select features from public.plans where code = 'inicial'), array['finance', 'medals']::text[], 'o pacote ficou com as duas, em ordem');

-- 6. Auditoria e geração automática de mensalidades
reset role;
select is((select count(*)::int from public.audit_events where action = 'academy.plan'), 3, 'cada troca de pacote foi auditada (e a repetida nao)');
select is((select count(*)::int from public.audit_events where action = 'plan.features'), 1, 'e a edicao do pacote tambem');
update public.academies set auto_charges = true, plan_code = 'avancado' where id = '00000000-0000-0000-0000-00000000ac01';
update public.plans set features = '{}' where code = 'avancado';
select lives_ok($$select public.run_auto_charges()$$, 'a geracao automatica nao quebra com o financeiro desligado');

select * from finish();
rollback;
