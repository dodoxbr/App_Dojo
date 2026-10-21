-- The legal guardian follows the child through the feed; separate authorization for the social networks. Synthetic data only.
begin;
select plan(23);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'externo@example.test', '{"display_name":"Externo","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'resp1@example.test', '{"display_name":"Resp Um","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000e2', 'fin@example.test', '{"display_name":"Resp Financeiro","birth_date":"1982-02-02"}'),
 ('00000000-0000-0000-0000-0000000000e3', 'resp3@example.test', '{"display_name":"Resp Tres","birth_date":"1983-03-03"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'menor1@example.test', jsonb_build_object('display_name', 'Menor Um', 'birth_date', (current_date - interval '9 years')::date::text, 'dependent', true)),
 ('00000000-0000-0000-0000-0000000000d2', 'menor2@example.test', jsonb_build_object('display_name', 'Menor Dois', 'birth_date', (current_date - interval '10 years')::date::text, 'dependent', true)),
 ('00000000-0000-0000-0000-0000000000d3', 'menor3@example.test', jsonb_build_object('display_name', 'Menor Tres', 'birth_date', (current_date - interval '11 years')::date::text, 'dependent', true)),
 ('00000000-0000-0000-0000-0000000000d4', 'menor4@example.test', jsonb_build_object('display_name', 'Menor Quatro', 'birth_date', (current_date - interval '12 years')::date::text, 'dependent', true));
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'fg-um', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'student', 'approved');
insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae'),
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e2', 'financial', 'tio'),
 ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae'),
 ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e3', 'legal', 'pai'),
 ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae');
-- d1: photos + social | d2: photos only | d3: photos only (another guardian)
insert into public.guardian_consents (academy_id, minor_user_id, guardian_user_id, status, verified_by, verified_at, document_checked, consent_photos, consent_social, consent_text_version) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, true, true, 'rascunho-2026-11'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, true, false, 'rascunho-2026-11'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e3', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, true, false, 'rascunho-2026-11');
insert into public.profile_contacts (user_id, full_name, phone, postal_code, street, number, neighborhood, city, state, emergency_name, emergency_phone, emergency_relationship, updated_by)
  values ('00000000-0000-0000-0000-0000000000d4', 'Menor Quatro', '11999990000', '01001000', 'Rua Ficticia', '1', 'Centro', 'Sao Paulo', 'SP', 'Contato', '11977776666', 'mae', '00000000-0000-0000-0000-0000000000e1');
create temp table pics as select decode('ffd8ffe000104a46494600010100000100010000', 'hex') as ok;
grant select on pics to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'treino do um (teste)', (select ok from pics), 100, 100, true, '{00000000-0000-0000-0000-0000000000d1}', gen_random_uuid())$$, 'post com o menor 1');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'treino do dois (teste)', (select ok from pics), 100, 100, true, '{00000000-0000-0000-0000-0000000000d2}', gen_random_uuid())$$, 'post com o menor 2');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'treino do tres (teste)', (select ok from pics), 100, 100, true, '{00000000-0000-0000-0000-0000000000d3}', gen_random_uuid())$$, 'post com o menor 3');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'so adultos (teste)', (select ok from pics), 100, 100, false, '{}', gen_random_uuid())$$, 'post so com adultos');

-- Which posts may go to the social networks (shown to the author and the manager)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select social_ok from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'treino do um (teste)'), true, 'menor com autorizacao de redes sociais: pode');
select is((select social_ok from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'treino do dois (teste)'), false, 'menor so com foto: nao publicar nas redes');
select is((select social_ok from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'so adultos (teste)'), true, 'sem menores marcados: nada a bloquear');

-- The legal guardian follows only the posts that show their child
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_dependent_feed('00000000-0000-0000-0000-0000000000d1')), 1, 'o responsavel ve o treino do filho 1');
select is((select count(*)::int from public.list_dependent_feed('00000000-0000-0000-0000-0000000000d2')), 1, 'e do filho 2');
select is((select count(*)::int from public.feed_posts), 2, 'a tabela (e a foto) so deixa ver os 2 posts dos filhos dele');
select throws_ok($$select * from public.list_dependent_feed('00000000-0000-0000-0000-0000000000d3')$$, '42501', null, 'nao ve o feed de filho de outro responsavel');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 100, 100, false, '{}', gen_random_uuid())$$, '42501', null, 'o responsavel acompanha, mas nao e membro: nao posta');
select throws_ok($$select * from public.list_feed('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'e nao ve o feed inteiro da academia');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select throws_ok($$select * from public.list_dependent_feed('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'o responsavel financeiro nao acompanha o treino');
select is((select count(*)::int from public.feed_posts), 0, 'nem pela tabela');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select * from public.list_dependent_feed('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'terceiros nao acompanham');

-- Hidden posts and revoked consent take the post away from the guardian too
reset role;
update public.feed_posts set status = 'hidden', hidden_reason = 'reported' where caption = 'treino do dois (teste)';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_dependent_feed('00000000-0000-0000-0000-0000000000d2')), 0, 'post oculto some para o responsavel');
select lives_ok($$select public.revoke_guardian_consent((select id from public.guardian_consents where minor_user_id = '00000000-0000-0000-0000-0000000000d1'))$$, 'o responsavel revoga o consentimento do filho 1');
select is((select count(*)::int from public.list_dependent_feed('00000000-0000-0000-0000-0000000000d1')), 0, 'depois de revogar, as fotos deixam de aparecer');

-- The consent: social networks need the photo authorization
select throws_ok($$select public.request_dependent_membership('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-00000000ac01', false, true)$$, '22023', null, 'redes sociais sem autorizar a foto e rejeitado');
select lives_ok($$select public.request_dependent_membership('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-00000000ac01', true, true)$$, 'foto e redes sociais autorizadas no pedido');
select is((select consent_social from public.guardian_consents where minor_user_id = '00000000-0000-0000-0000-0000000000d4'), true, 'a autorizacao de redes sociais fica registrada');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select consent_social from public.list_academy_guardian_consents('00000000-0000-0000-0000-00000000ac01') where minor_user_id = '00000000-0000-0000-0000-0000000000d4'), true, 'o gestor ve que foi autorizado');

select * from finish();
rollback;
