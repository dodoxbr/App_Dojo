-- US-018: photo feed of the academy. Synthetic data only (the "pictures" are just bytes that start like a JPEG).
begin;
select plan(53);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a2', 'gestor2@example.test', '{"display_name":"Gestor Dois","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a9', 'admin@example.test', '{"display_name":"Super Admin","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000c1', 'prof@example.test', '{"display_name":"Professor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b3', 'aluno3@example.test', '{"display_name":"Aluno Tres","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'resp@example.test', '{"display_name":"Resp Legal","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000f1', 'externo@example.test', '{"display_name":"Externo","birth_date":"1981-01-01"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'menor1@example.test', jsonb_build_object('display_name', 'Menor Com Foto', 'birth_date', (current_date - interval '9 years')::date::text, 'dependent', true)),
 ('00000000-0000-0000-0000-0000000000d2', 'menor2@example.test', jsonb_build_object('display_name', 'Menor Sem Foto', 'birth_date', (current_date - interval '10 years')::date::text, 'dependent', true));
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a9');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'feed-um', '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'feed-dois', '00000000-0000-0000-0000-0000000000a2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000a2', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'student', 'suspended'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'approved');
insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae'),
 ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae');
-- d1: verified consent WITH photos; d2: verified consent WITHOUT photos
insert into public.guardian_consents (academy_id, minor_user_id, guardian_user_id, status, verified_by, verified_at, document_checked, consent_photos, consent_text_version) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, true, 'rascunho-2026-10'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, false, 'rascunho-2026-10');
-- Desde a migration 040 o adulto so pode ser marcado se autorizou o uso da imagem.
insert into public.adult_image_consents (academy_id, user_id, signed_name, term_version) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'Aluno Dois Teste', 'rascunho-2026-12');
create temp table pics as select decode('ffd8ffe000104a46494600010100000100010000', 'hex') as ok, decode('89504e470d0a1a0a', 'hex') as png,
  decode(repeat('ff', 800001), 'hex') as big;
grant select on pics to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- 1. Posting: any adult approved member; strict checks on the picture
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'treino de sexta (teste)', (select ok from pics), 1200, 800, false, '{}', '11111111-1111-1111-1111-111111111111')$$, 'aluno posta uma foto');
select is((select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'treino de sexta (teste)', (select ok from pics), 1200, 800, false, '{}', '11111111-1111-1111-1111-111111111111')),
          (select id from public.feed_posts where caption = 'treino de sexta (teste)'), 'repetir a mesma chave devolve o mesmo post');
select is((select count(*)::int from public.feed_posts), 1, 'sem duplicar');
select is((select (expires_at - created_at) from public.feed_posts), interval '30 days', 'a foto vive 30 dias');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select png from pics), 100, 100, false, '{}', gen_random_uuid())$$, '22023', null, 'so JPEG (assinatura conferida no banco)');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select big from pics), 100, 100, false, '{}', gen_random_uuid())$$, '22023', null, 'imagem acima de 800 KB rejeitada');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', repeat('x', 501), (select ok from pics), 100, 100, false, '{}', gen_random_uuid())$$, '22023', null, 'legenda acima de 500 caracteres');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 0, 100, false, '{}', gen_random_uuid())$$, '22023', null, 'dimensoes invalidas');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000f1}', gen_random_uuid())$$, '22023', null, 'nao se marca quem nao e da academia');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'com marcacao (teste)', (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000b2}', gen_random_uuid())$$, 'marcar um adulto da academia');

-- 2. Photos with minors: declared, tagged, and only with the guardian's photo consent
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 100, 100, true, '{}', gen_random_uuid())$$, '22023', null, 'diz que ha menor mas nao marca ninguem');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 100, 100, true, '{00000000-0000-0000-0000-0000000000d2}', gen_random_uuid())$$, '22023', null, 'menor sem consentimento de foto nao pode ser marcado');
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 100, 100, false, '{00000000-0000-0000-0000-0000000000d2}', gen_random_uuid())$$, '22023', null, 'nem sem declarar: marcar ja exige o consentimento');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'com o menor (teste)', (select ok from pics), 100, 100, true, '{00000000-0000-0000-0000-0000000000d1}', gen_random_uuid())$$, 'menor com consentimento de foto aparece');
select is((select has_minors from public.feed_posts where caption = 'com o menor (teste)'), true, 'o post fica marcado como tendo menor');
-- Desde a migration 038, foto com menor espera a aprovacao do moderador antes de aparecer no feed.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.moderate_feed_post((select id from public.feed_posts where caption = 'com o menor (teste)'), true)$$, 'o gestor aprova a foto com o menor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- 3. Only members post and see; the platform admin and strangers do not
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', null, (select ok from pics), 100, 100, false, '{}', gen_random_uuid())$$, '42501', null, 'quem nao e da academia nao posta');
select throws_ok($$select * from public.list_feed('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'nem le o feed');
select is((select count(*)::int from public.feed_posts), 0, 'nem a tabela');
select throws_ok($$select * from public.list_feed_people('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'nem a lista de pessoas');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select * from public.list_feed('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'super admin nao ve o feed');
select is((select count(*)::int from public.feed_posts), 0, 'nem a tabela');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$select * from public.list_feed('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'gestor de outra academia nao ve');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select throws_ok($$select * from public.list_feed('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'membro suspenso nao ve');

-- 4. Everyone in the academy sees (student, teacher, manager)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.list_feed('00000000-0000-0000-0000-00000000ac01')), 3, 'outro aluno ve os 3 posts');
select is((select jsonb_array_length(tags) from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'com o menor (teste)'), 1, 'e as marcacoes');
select is((select count(*)::int from public.feed_posts), 3, 'a tabela segue a mesma regra');
select is((select count(*)::int from public.list_feed_people('00000000-0000-0000-0000-00000000ac01')), 6, 'lista de pessoas da academia (aprovadas)');
select is((select photo_ok from public.list_feed_people('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000d2'), false, 'a lista mostra que o menor sem consentimento nao pode ser marcado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_feed('00000000-0000-0000-0000-00000000ac01')), 3, 'o professor tambem');
select lives_ok($$select public.create_feed_post('00000000-0000-0000-0000-00000000ac01', 'foto do professor (teste)', (select ok from pics), 100, 100, false, '{}', gen_random_uuid())$$, 'e posta');

-- 5. Direct writes are closed
select throws_ok($$insert into public.feed_posts (academy_id, author_user_id, image, mime, width, height, client_key, expires_at) values ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', '\xffd8ff', 'image/jpeg', 1, 1, gen_random_uuid(), now())$$, '42501', null, 'sem INSERT direto');
select throws_ok($$update public.feed_posts set caption = 'x'$$, '42501', null, 'sem UPDATE direto');
select throws_ok($$select * from public.feed_post_tags$$, '42501', null, 'as marcacoes so passam pelas funcoes');

-- 6. Reports hide the post; the manager decides
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok($$select public.report_feed_post((select id from public.feed_posts where caption = 'treino de sexta (teste)'), 'foto inadequada (teste)')$$, 'membro denuncia um post');
select throws_ok($$select public.report_feed_post((select id from public.feed_posts where caption = 'foto do professor (teste)'), 'x')$$, '22023', null, 'motivo curto demais');
select is((select count(*)::int from public.list_feed('00000000-0000-0000-0000-00000000ac01')), 3, 'o post denunciado some para os outros membros');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select status from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'treino de sexta (teste)'), 'hidden', 'mas o autor ainda o ve, oculto');
select throws_ok($$select public.report_feed_post((select id from public.feed_posts where caption = 'treino de sexta (teste)'), 'meu proprio post')$$, '42501', null, 'ninguem denuncia o proprio post');
select throws_ok($$select public.restore_feed_post((select id from public.feed_posts where caption = 'treino de sexta (teste)'))$$, '42501', null, 'so o gestor devolve o post');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_feed_reports((select id from public.feed_posts where caption = 'treino de sexta (teste)'))), 1, 'gestor le o motivo da denuncia');
select lives_ok($$select public.restore_feed_post((select id from public.feed_posts where caption = 'treino de sexta (teste)'))$$, 'gestor devolve o post ao feed');

-- 7. Revoking the photo consent hides the posts that show the minor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select lives_ok($$select public.revoke_guardian_consent((select id from public.guardian_consents where minor_user_id = '00000000-0000-0000-0000-0000000000d1'))$$, 'o responsavel revoga o consentimento');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select hidden_reason from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'com o menor (teste)'), 'consent revoked', 'o post com o menor foi ocultado na hora');
select throws_ok($$select public.restore_feed_post((select id from public.feed_posts where caption = 'com o menor (teste)'))$$, '22023', null, 'e nao volta enquanto nao houver consentimento de foto');

-- 8. Deleting is real; expiry hides and then purges
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select public.delete_feed_post((select id from public.feed_posts where caption = 'foto do professor (teste)'))$$, '42501', null, 'outro aluno nao apaga');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$select public.delete_feed_post((select id from public.feed_posts where caption = 'foto do professor (teste)'))$$, 'o autor apaga');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.delete_feed_post((select id from public.feed_posts where caption = 'com marcacao (teste)'))$$, 'o gestor apaga');

reset role;
update public.feed_posts set expires_at = now() - interval '1 minute' where caption = 'treino de sexta (teste)';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'treino de sexta (teste)'), 0, 'vencida: some do feed mesmo antes da limpeza');
reset role;
select is(public.purge_expired_feed_posts(), 1, 'a limpeza noturna apaga de verdade o que venceu');
select is((select count(*)::int from public.feed_posts where caption = 'treino de sexta (teste)'), 0, 'a linha (e a foto) nao existe mais');
select is((select count(*)::int from cron.job where jobname = 'purge-feed' and active), 1, 'a limpeza esta agendada');
select is((select count(*)::int from public.audit_events where action = 'feed.post' and (metadata::text like '%ffd8%' or metadata::text like '%treino%')), 0, 'a auditoria nao guarda a foto nem a legenda');

select * from finish();
rollback;
