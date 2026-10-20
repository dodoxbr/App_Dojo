-- US-005: technique catalog, search, aliases and review. Synthetic users; the seed comes from the real migration.
begin;
select plan(47);

-- Fixtures (as postgres)
-- a1 platform admin | b1 manager ac01 | b2 manager ac02 | c1 student ac01 | c2 pending ac01 | d1 plain user
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
 ('00000000-0000-0000-0000-0000000000b1', 'gestor1@example.test'),
 ('00000000-0000-0000-0000-0000000000b2', 'gestor2@example.test'),
 ('00000000-0000-0000-0000-0000000000c1', 'aluno1@example.test'),
 ('00000000-0000-0000-0000-0000000000c2', 'pendente@example.test'),
 ('00000000-0000-0000-0000-0000000000d1', 'comum@example.test');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'catalogo-um', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'catalogo-dois', '00000000-0000-0000-0000-0000000000b2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000b2', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c2', 'student', 'pending');
insert into public.techniques (id, academy_id, name, category) values
 ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000ac01', 'Tecnica Interna Um', 'Interna'),
 ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000ac02', 'Tecnica Interna Dois', 'Interna');

-- Seed integrity ------------------------------------------------------------------------------
select is((select count(*)::int from public.techniques where academy_id is null and source = 'Plano de Treino_Básico ao Avançado.xlsx'), 131, 'seed: 131 tecnicas globais importadas');
select is((select count(*)::int from public.techniques where source is not null and reviewed_at is null), 0, 'seed: todas marcadas como revisadas');
select is((select count(*)::int from public.technique_sources), 151, 'seed: 151 origens (linhas da planilha)');
select is_empty($$select 1 from public.techniques t where t.source is not null and not exists (select 1 from public.technique_sources s where s.technique_id = t.id)$$, 'seed: toda tecnica tem origem');
select is((select name from public.techniques where id = 'f0085f40-8d58-5777-aac6-01c39cd03890'), 'Queda de Frente', 'seed: id estavel');
select is((select count(*)::int from public.technique_sources where technique_id = 'f0085f40-8d58-5777-aac6-01c39cd03890'), 3, 'seed: tecnica nos tres niveis guarda as tres origens');
select is(public.normalize_text('  Ação   Ç  '), 'acao c', 'normalize_text remove acento, caixa e espacos extras');

set local role authenticated;

-- Search (plain user sees the global catalog only) --------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.search_techniques('SAIDA DE QUADRIL')), 1, 'busca ignora caixa');
select is((select count(*)::int from public.search_techniques('Saída de Quadril')), 1, 'busca ignora acento');
select is((select name from public.search_techniques('tesoura') limit 1), 'Tesoura', 'correspondencia exata vem primeiro');
select is((select count(*)::int from public.search_techniques(null, 'FUNDAMENTOS', 100, 0)), 10, 'filtro por categoria ignora caixa');
select is((select count(*)::int from public.search_techniques('%')), 0, 'curinga % nao casa tudo');
select is((select count(*)::int from public.search_techniques('_')), 0, 'curinga _ nao casa tudo');
select is((select count(*)::int from public.search_techniques(null, null, 1000, 0)), 100, 'limite maximo de 100 por pagina');
select is((select count(*)::int from public.search_techniques('interna')), 0, 'usuario comum nao ve tecnica de academia');
select is((select count(*)::int from public.technique_sources), 0, 'usuario comum nao le proveniencia');

-- Academy-scoped visibility -------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.search_techniques('tecnica interna')), 1, 'aluno aprovado ve a tecnica da propria academia');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*)::int from public.search_techniques('tecnica interna')), 0, 'filiacao pendente nao ve tecnica interna');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select name from public.search_techniques('tecnica interna')), 'Tecnica Interna Dois', 'gestor de outra academia ve so a sua');

-- Creating techniques -------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.create_technique(null, 'Global do Gestor', 'Teste', null, null, gen_random_uuid())$$, '42501', null, 'gestor nao cria tecnica global');
select throws_ok($$select public.create_technique('00000000-0000-0000-0000-00000000ac02', 'Invasao', 'Teste', null, null, gen_random_uuid())$$, '42501', null, 'gestor nao cria tecnica em outra academia');
select throws_ok($$insert into public.techniques (academy_id, name, category) values ('00000000-0000-0000-0000-00000000ac01', 'Direta', 'Teste')$$, '42501', null, 'sem INSERT direto em techniques');
select lives_ok($$select public.create_technique('00000000-0000-0000-0000-00000000ac01', '  Raspagem Teste  ', 'Raspagens', 'Básico', 'descricao sintetica', '33333333-3333-3333-3333-333333333333')$$, 'gestor cria tecnica da academia');
select is((select public.create_technique('00000000-0000-0000-0000-00000000ac01', 'Raspagem Teste', 'Raspagens', 'Básico', null, '33333333-3333-3333-3333-333333333333')),
          (select id from public.techniques where name = 'Raspagem Teste' and academy_id = '00000000-0000-0000-0000-00000000ac01'), 'criacao idempotente');
select throws_ok($$select public.create_technique('00000000-0000-0000-0000-00000000ac01', 'RASPAGEM  téste', 'raspagens', null, null, gen_random_uuid())$$, '23505', null, 'nome duplicado (ignorando acento/caixa) na mesma academia = CONFLICT');
select lives_ok($$select public.create_technique('00000000-0000-0000-0000-00000000ac01', 'Postura', 'Passagem de Guarda', null, null, gen_random_uuid())$$, 'mesmo nome de uma global e permitido em escopo de academia');
select throws_ok($$select public.create_technique('00000000-0000-0000-0000-00000000ac01', 'x', 'Teste', null, null, gen_random_uuid())$$, '22023', null, 'nome curto = VALIDATION_ERROR');
select throws_ok($$select public.create_technique('00000000-0000-0000-0000-00000000ac01', 'Longa', 'Teste', null, repeat('a', 4001), gen_random_uuid())$$, '22023', null, 'descricao longa = VALIDATION_ERROR');

-- Student cannot manage the catalog
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.create_technique('00000000-0000-0000-0000-00000000ac01', 'Do Aluno', 'Teste', null, null, gen_random_uuid())$$, '42501', null, 'aluno nao cria tecnica');
select throws_ok($$select public.review_technique('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'aluno nao revisa tecnica');

-- Manager: update, review, aliases
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.review_technique('00000000-0000-0000-0000-0000000000f1')$$, 'gestor revisa tecnica da academia');
select is((select reviewed_by from public.techniques where id = '00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-0000000000b1'::uuid, 'revisor registrado');
select lives_ok($$select public.update_technique('00000000-0000-0000-0000-0000000000f1', 'Tecnica Interna Um', 'Interna', 'Avançado', 'nova descricao')$$, 'gestor edita tecnica da academia');
select is((select reviewed_at is null from public.techniques where id = '00000000-0000-0000-0000-0000000000f1'), true, 'editar invalida a revisao anterior');
select throws_ok($$select public.update_technique('f0085f40-8d58-5777-aac6-01c39cd03890', 'Queda Alterada', 'Fundamentos', null, null)$$, '42501', null, 'gestor nao edita tecnica global');
select throws_ok($$select public.update_technique('00000000-0000-0000-0000-0000000000f2', 'Invasao', 'Interna', null, null)$$, '42501', null, 'gestor nao edita tecnica de outra academia');
select lives_ok($$select public.add_technique_alias('00000000-0000-0000-0000-0000000000f1', 'Sinônimo Teste')$$, 'gestor cadastra sinonimo');
select throws_ok($$select public.add_technique_alias('00000000-0000-0000-0000-0000000000f1', 'sinonimo   teste')$$, '23505', null, 'sinonimo duplicado (ignorando acento/caixa) = CONFLICT');
select is((select matched_alias from public.search_techniques('SINONIMO TESTE')), 'Sinônimo Teste', 'busca encontra tecnica pelo sinonimo');
select throws_ok($$select public.add_technique_alias('f0085f40-8d58-5777-aac6-01c39cd03890', 'Alias Global')$$, '42501', null, 'gestor nao cadastra sinonimo em global');

-- Plain user cannot see academy aliases; student can
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.technique_aliases), 0, 'usuario comum nao le sinonimos de academia');
select throws_ok($$select public.remove_technique_alias((select id from public.technique_aliases limit 1))$$, '42501', null, 'remover sinonimo inexistente/alheio = FORBIDDEN');

-- Platform admin: global catalog management
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.update_technique('f0085f40-8d58-5777-aac6-01c39cd03890', 'Queda de Frente', 'Fundamentos', 'Básico', 'descricao sintetica')$$, 'super admin edita tecnica global');
select lives_ok($$select public.review_technique('f0085f40-8d58-5777-aac6-01c39cd03890')$$, 'super admin revisa tecnica global');
select lives_ok($$select public.create_technique(null, 'Global de Teste', 'Teste', null, null, gen_random_uuid())$$, 'super admin cria tecnica global');
select ok((select count(*) from public.technique_sources) >= 151, 'super admin le a proveniencia');
select is((select count(*)::int from public.search_techniques('tecnica interna')), 2, 'super admin ve tecnicas de todas as academias');

select * from finish();
rollback;
