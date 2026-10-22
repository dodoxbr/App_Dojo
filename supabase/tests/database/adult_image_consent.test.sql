-- Declaracoes no cadastro (migration 041): autorizacao de imagem e declaracao de saude. Dados sinteticos.
begin;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1991-01-01","terms_version":"rascunho-2026-12","health_declaration":"true","image_authorization":"true"}'),
 ('00000000-0000-0000-0000-0000000000b3', 'aluno3@example.test', '{"display_name":"Aluno Tres","birth_date":"1992-01-01","terms_version":"rascunho-2026-12","health_declaration":"true"}');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'ai-um', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'student', 'approved');
create temp table pics as select decode('ffd8ffe000104a46494600010100000100010000', 'hex') as ok;
grant select on pics to authenticated;

set local role authenticated;

-- 1. O cadastro registra o que a pessoa marcou
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select health_declared from public.my_declarations()), true, 'cadastro com declaracao de saude marcada: registrada');
select is((select image_authorized from public.my_declarations()), true, 'e com a autorizacao de imagem marcada: registrada');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select is((select image_authorized from public.my_declarations()), false, 'quem nao marcou a imagem fica sem autorizacao');
select is((select health_declared from public.my_declarations()), true, 'mas declarou a saude');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select health_declared from public.my_declarations()), false, 'conta sem declaracao (antiga) aparece pendente');

-- 2. So quem autorizou pode ser marcado; quem posta pode marcar a si mesmo
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000b3}', gen_random_uuid())$$, '22023', null, 'adulto que nao autorizou nao pode ser marcado');
select is((select photo_ok from public.list_feed_people('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b3'), false, 'a lista de marcacao mostra isso');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'me marquei (ai)', (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000b1}', gen_random_uuid())$$, 'quem posta pode marcar a si mesmo');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'com o colega (ai)', (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000b2}', gen_random_uuid())$$, 'colega que autorizou no cadastro pode ser marcado');

-- 3. Autorizar depois, no perfil, e declarar a saude (conta antiga)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select lives_ok($$select public.set_image_authorization(true)$$, 'quem nao marcou no cadastro autoriza depois');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.declare_health('rascunho-2026-12')$$, 'conta antiga declara a saude');
select is((select health_declared from public.my_declarations()), true, 'e fica registrada');

-- 4. Revogar tira as fotos dele do feed
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok($$select public.set_image_authorization(false)$$, 'ele revoga a autorizacao');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select status || '/' || hidden_reason from public.feed_posts where caption = 'com o colega (ai)'), 'hidden/consent revoked', 'as fotos em que ele aparece saem do feed');

select * from finish();
rollback;
