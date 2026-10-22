-- Feed: moderação pelo professor (migration 038). Foto com menor ou de responsável espera aprovação; o instrutor é moderador. Dados sintéticos.
begin;
select plan(24);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000c1', 'prof@example.test', '{"display_name":"Professor Um","birth_date":"1988-08-08"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1991-01-01"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'resp1@example.test', '{"display_name":"Resp Um","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000e3', 'resp3@example.test', '{"display_name":"Resp Tres","birth_date":"1983-03-03"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'menor1@example.test', jsonb_build_object('display_name', 'Menor Um', 'birth_date', (current_date - interval '9 years')::date::text, 'dependent', true)),
 ('00000000-0000-0000-0000-0000000000d3', 'menor3@example.test', jsonb_build_object('display_name', 'Menor Tres', 'birth_date', (current_date - interval '11 years')::date::text, 'dependent', true));
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'mod-um', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'student', 'approved');
insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae'),
 ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e3', 'legal', 'pai');
insert into public.guardian_consents (academy_id, minor_user_id, guardian_user_id, status, verified_by, verified_at, document_checked, consent_photos, consent_social, consent_text_version) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, true, true, 'rascunho-2026-11'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e3', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, true, false, 'rascunho-2026-11');
create temp table pics as select decode('ffd8ffe000104a46494600010100000100010000', 'hex') as ok;
grant select on pics to authenticated;

set local role authenticated;

-- 1. Aluno adulto: foto so com adultos publica direto; com menor fica pendente
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'so adultos (mod)', (select ok from pics), 100, 100, false, '{}', gen_random_uuid())$$, 'aluno posta foto so com adultos');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'com menor (mod)', (select ok from pics), 100, 100, true, '{00000000-0000-0000-0000-0000000000d1}', gen_random_uuid())$$, 'aluno posta foto com menor');
select is((select status from public.feed_posts where caption = 'so adultos (mod)'), 'visible', 'so adultos: publicada');
select is((select status from public.feed_posts where caption = 'com menor (mod)'), 'pending', 'com menor: aguarda aprovacao');
select is((select status from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'com menor (mod)'), 'pending', 'o autor ve a propria foto pendente');

-- 2. Outro aluno nao ve a pendente; nao modera
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'com menor (mod)'), 0, 'outro aluno nao ve a foto pendente');
select is((select count(*)::int from public.feed_posts where caption = 'com menor (mod)'), 0, 'nem pela tabela (RLS)');
select throws_ok($$select public.moderate_feed_post((select id from public.feed_posts where caption = 'so adultos (mod)'), true)$$, '42501', null, 'aluno nao modera');
select is((select public.pending_feed_count('00000000-0000-0000-0000-00000000ac01')), 0, 'aluno nao ve a fila (contagem 0)');

-- 3. O instrutor e moderador: ve a fila, aprova, recusa, apaga
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select public.pending_feed_count('00000000-0000-0000-0000-00000000ac01')), 1, 'o professor ve 1 foto aguardando');
select is((select status from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'com menor (mod)'), 'pending', 'e a foto pendente na lista');
select lives_ok($$select public.moderate_feed_post((select id from public.feed_posts where caption = 'com menor (mod)'), true)$$, 'o professor aprova');
select is((select status from public.feed_posts where caption = 'com menor (mod)'), 'visible', 'agora publicada');
select throws_ok($$select public.moderate_feed_post((select id from public.feed_posts where caption = 'com menor (mod)'), true)$$, '22023', null, 'so se modera o que esta pendente');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'com menor (mod)'), 1, 'agora os outros alunos veem');

-- 4. Professor posta direto (e moderador); responsavel posta so com o proprio menor e fica pendente; recusa exige motivo
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'do professor com menor (mod)', (select ok from pics), 100, 100, true, '{00000000-0000-0000-0000-0000000000d1}', gen_random_uuid())$$, 'professor posta com menor');
select is((select status from public.feed_posts where caption = 'do professor com menor (mod)'), 'visible', 'professor publica direto');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'da mae (mod)', (select ok from pics), 100, 100, true, '{00000000-0000-0000-0000-0000000000d1}', gen_random_uuid())$$, 'responsavel posta com o proprio menor');
select is((select status from public.feed_posts where caption = 'da mae (mod)'), 'pending', 'a do responsavel aguarda aprovacao');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'invasao (mod)', (select ok from pics), 100, 100, true, '{00000000-0000-0000-0000-0000000000d3}', gen_random_uuid())$$, '22023', null, 'responsavel nao marca menor que nao e dele');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'sem marca (mod)', (select ok from pics), 100, 100, false, '{}', gen_random_uuid())$$, '22023', null, 'responsavel precisa marcar o proprio menor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.moderate_feed_post((select id from public.feed_posts where caption = 'da mae (mod)'), false, 'x')$$, '22023', null, 'recusar exige um motivo (3 a 200 caracteres)');
select lives_ok($$select public.moderate_feed_post((select id from public.feed_posts where caption = 'da mae (mod)'), false, 'Legenda fora do respeito do tatame')$$, 'o gestor recusa com motivo');
select is((select (status || '/' || hidden_reason) from public.feed_posts where caption = 'da mae (mod)'), 'rejected/Legenda fora do respeito do tatame', 'recusada, com o motivo');

select * from finish();
rollback;
