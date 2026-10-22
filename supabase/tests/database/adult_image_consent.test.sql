-- Autorização de imagem dos adultos no feed interno (migration 040). Dados sintéticos.
begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1991-01-01"}'),
 ('00000000-0000-0000-0000-0000000000f1', 'externo@example.test', '{"display_name":"Externo","birth_date":"1981-01-01"}');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'ai-um', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved');
create temp table pics as select decode('ffd8ffe000104a46494600010100000100010000', 'hex') as ok;
grant select on pics to authenticated;

set local role authenticated;

-- 1. Marcar um adulto exige a autorização dele; marcar a si mesmo, não
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000b2}', gen_random_uuid())$$, '22023', null, 'adulto sem autorizacao nao pode ser marcado');
select is((select photo_ok from public.list_feed_people('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b2'), false, 'a lista de marcacao mostra que ainda nao autorizou');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'me marquei (ai)', (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000b1}', gen_random_uuid())$$, 'quem posta pode marcar a si mesmo');

-- 2. O adulto autoriza (nome completo) e passa a poder ser marcado
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select public.give_image_consent('00000000-0000-0000-0000-00000000ac01', 'Aluno')$$, '22023', null, 'a assinatura e o nome completo');
select lives_ok($$select public.give_image_consent('00000000-0000-0000-0000-00000000ac01', 'Aluno Dois Teste')$$, 'o adulto autoriza o uso da imagem');
select is((select active from public.my_image_consents() where academy_id = '00000000-0000-0000-0000-00000000ac01'), true, 'e ve a autorizacao ativa');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'com o colega (ai)', (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000b2}', gen_random_uuid())$$, 'agora o colega pode ser marcado');

-- 3. Revogar tira as fotos dele do feed; de fora nao autoriza
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok($$select public.revoke_image_consent('00000000-0000-0000-0000-00000000ac01')$$, 'ele revoga a autorizacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select status || '/' || hidden_reason from public.feed_posts where caption = 'com o colega (ai)'), 'hidden/consent revoked', 'as fotos em que ele aparece saem do feed');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000b2}', gen_random_uuid())$$, '22023', null, 'depois de revogar, nao pode mais ser marcado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.give_image_consent('00000000-0000-0000-0000-00000000ac01', 'Externo Teste Silva')$$, '42501', null, 'quem nao e da academia nao autoriza');
select is((select count(*)::int from public.my_image_consents()), 0, 'e nao tem academias na lista');

select * from finish();
rollback;
