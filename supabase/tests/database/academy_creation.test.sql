-- US-003: academy creation, roles, theme and instructor permissions. Synthetic data only.
begin;
select plan(45);

-- Fixtures (as postgres)
-- a0 super admin | b0 creator | c0 plain user | d0 instructor | e0 manager of another academy
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a0', 'admin@example.test'),
 ('00000000-0000-0000-0000-0000000000b0', 'criador@example.test'),
 ('00000000-0000-0000-0000-0000000000c0', 'comum@example.test'),
 ('00000000-0000-0000-0000-0000000000d0', 'instrutor@example.test'),
 ('00000000-0000-0000-0000-0000000000e0', 'outro@example.test');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a0');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Outra', 'academia-outra', '00000000-0000-0000-0000-0000000000e0');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e0', 'manager', 'approved');

-- Pure contrast math (WCAG reference values)
select is(round(public.contrast_ratio('#000000', '#FFFFFF')::numeric, 2), 21.00, 'contraste preto/branco = 21');
select is(round(public.contrast_ratio('#777777', '#FFFFFF')::numeric, 2), 4.48, 'contraste #777/branco = 4.48');

set local role authenticated;

-- anon / unauthorized
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c0","role":"authenticated"}', true);
select throws_ok($$select public.create_academy('Academia X', 'academia-x', gen_random_uuid())$$, '42501', null, 'usuario comum nao cria academia');
select throws_ok($$select public.grant_academy_creator('comum@example.test')$$, '42501', null, 'usuario comum nao libera criador');
select is((select public.is_platform_admin()), false, 'usuario comum nao e super admin');

-- Super admin grants creator
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select is((select public.is_platform_admin()), true, 'super admin reconhecido');
select throws_ok($$select public.grant_academy_creator('naoexiste@example.test')$$, 'P0002', null, 'e-mail sem conta = NOT_FOUND');
select is((select public.grant_academy_creator('Criador@Example.Test')), '00000000-0000-0000-0000-0000000000b0'::uuid, 'super admin libera criador (e-mail case-insensitive)');

-- Creator creates the academy
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
select throws_ok($$select public.grant_academy_creator('comum@example.test')$$, '42501', null, 'criador nao libera outros criadores');
select lives_ok($$select public.create_academy('  Academia Teste  ', 'Academia-Teste', '11111111-1111-1111-1111-111111111111')$$, 'criador cria academia');
select is((select public.create_academy('Academia Teste', 'academia-teste', '11111111-1111-1111-1111-111111111111')),
          (select id from public.academies where slug = 'academia-teste'), 'idempotente: mesma chave devolve a mesma academia');
select is((select count(*)::int from public.academies where slug = 'academia-teste'), 1, 'sem duplicar a academia');
select is((select name from public.academies where slug = 'academia-teste'), 'Academia Teste', 'nome aparado');
select throws_ok($$select public.create_academy('Outra', 'academia-teste', gen_random_uuid())$$, '23505', null, 'slug repetido = CONFLICT');
select throws_ok($$select public.create_academy('Outra', 'Slug Invalido!', gen_random_uuid())$$, '22023', null, 'slug invalido = VALIDATION_ERROR');
select throws_ok($$select public.create_academy('x', 'slug-ok', gen_random_uuid())$$, '22023', null, 'nome curto = VALIDATION_ERROR');
select is((select count(*)::int from public.memberships where role = 'manager' and status = 'approved'
           and academy_id = (select id from public.academies where slug = 'academia-teste')), 1, 'criador e gestor aprovado');
select is((select count(*)::int from public.academy_role_permissions
           where academy_id = (select id from public.academies where slug = 'academia-teste')), 2, 'permissoes padrao do instrutor (minimas)');
select ok((select count(*) from public.audit_events where action = 'academy.create') = 1, 'criacao auditada');

-- Direct writes are denied
select throws_ok($$insert into public.academies (name, slug, owner_user_id) values ('Fake','fake','00000000-0000-0000-0000-0000000000b0')$$, '42501', null, 'sem INSERT direto em academies');
select throws_ok($$update public.academies set name = 'Hack'$$, '42501', null, 'sem UPDATE direto em academies');
select throws_ok($$insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000b0')$$, '42501', null, 'ninguem se torna super admin pelo app');
select throws_ok($$insert into public.audit_events (actor_user_id, action, entity) values ('00000000-0000-0000-0000-0000000000b0','x','y')$$, '42501', null, 'sem INSERT direto em audit_events');
select throws_ok($$insert into public.academy_creators (user_id, granted_by) values ('00000000-0000-0000-0000-0000000000c0','00000000-0000-0000-0000-0000000000b0')$$, '42501', null, 'sem INSERT direto em academy_creators');

-- Manager: theme
select lives_ok($$select public.update_academy_settings((select id from public.academies where slug = 'academia-teste'), 'Academia Nova', '#112233', '#FFFFFF')$$, 'gestor altera tema valido');
select is((select theme_primary from public.academies where slug = 'academia-teste'), '#112233', 'tema persistido');
select throws_ok($$select public.update_academy_settings((select id from public.academies where slug = 'academia-teste'), 'Academia Nova', '#777777', '#888888')$$, '22023', null, 'contraste insuficiente rejeitado');
select throws_ok($$select public.update_academy_settings((select id from public.academies where slug = 'academia-teste'), 'Academia Nova', 'vermelho', '#FFFFFF')$$, '22023', null, 'cor invalida rejeitada');
select throws_ok($$select public.update_academy_settings('00000000-0000-0000-0000-00000000ac02', 'Invasao', '#112233', '#FFFFFF')$$, '42501', null, 'gestor nao altera outra academia');

-- Manager: instructor permissions
select lives_ok($$select public.set_instructor_permission((select id from public.academies where slug = 'academia-teste'), 'assess_skills', true)$$, 'gestor habilita permissao do instrutor');
select throws_ok($$select public.set_instructor_permission((select id from public.academies where slug = 'academia-teste'), 'read_diary', true)$$, '22023', null, 'permissao fora do catalogo rejeitada (diario nunca e liberavel)');

-- Instructor (membership inserted as postgres)
reset role;
insert into public.memberships (academy_id, user_id, role, status)
  select id, '00000000-0000-0000-0000-0000000000d0', 'instructor', 'approved' from public.academies where slug = 'academia-teste';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d0","role":"authenticated"}', true);
select throws_ok($$select public.update_academy_settings((select id from public.academies where slug = 'academia-teste'), 'Hack', '#112233', '#FFFFFF')$$, '42501', null, 'instrutor nao altera tema');
select throws_ok($$select public.set_instructor_permission((select id from public.academies where slug = 'academia-teste'), 'view_progress', true)$$, '42501', null, 'instrutor nao altera a propria matriz');
select is((select public.has_academy_permission((select id from public.academies where slug = 'academia-teste'), 'assess_skills')), true, 'instrutor tem permissao habilitada');
select is((select public.has_academy_permission((select id from public.academies where slug = 'academia-teste'), 'recommend_graduation')), false, 'instrutor nao tem permissao nao habilitada');
select is((select count(*)::int from public.audit_events), 0, 'instrutor nao le auditoria');
select is((select count(*)::int from public.memberships), 2, 'instrutor com view_roster (padrao) ve os membros aprovados da academia: gestor e ele mesmo');

-- Manager reads own academy only
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
select ok((select count(*) from public.audit_events) >= 3, 'gestor le a auditoria da propria academia');
select is((select count(*)::int from public.memberships), 2, 'gestor ve os vinculos da propria academia');

-- Manager of another academy sees nothing from this one
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e0","role":"authenticated"}', true);
select is((select count(*)::int from public.audit_events), 0, 'outro gestor nao le auditoria alheia');
select is((select count(*)::int from public.memberships), 1, 'outro gestor ve so os proprios vinculos');

-- Super admin: full management access (testing phase) and revocation
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}', true);
select lives_ok($$select public.update_academy_settings((select id from public.academies where slug = 'academia-teste'), 'Academia Admin', '#112233', '#FFFFFF')$$, 'super admin altera qualquer academia');
select is((select count(*)::int from public.memberships
           where academy_id in ((select id from public.academies where slug = 'academia-teste'), '00000000-0000-0000-0000-00000000ac02')), 3, 'super admin ve os vinculos de todas as academias');
select lives_ok($$select public.revoke_academy_creator('00000000-0000-0000-0000-0000000000b0')$$, 'super admin revoga criador');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
select throws_ok($$select public.create_academy('Segunda', 'segunda', gen_random_uuid())$$, '42501', null, 'criador revogado nao cria novas academias');

select * from finish();
rollback;
