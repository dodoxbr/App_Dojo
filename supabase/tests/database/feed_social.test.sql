-- US-019: reactions and moderated comments on the feed. Synthetic data only.
begin;
select plan(48);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a2', 'gestor2@example.test', '{"display_name":"Gestor Dois","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a9', 'admin@example.test', '{"display_name":"Super Admin","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b3', 'aluno3@example.test', '{"display_name":"Aluno Suspenso","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b4', 'aluno4@example.test', '{"display_name":"Aluno Quatro","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b5', 'aluno5@example.test', '{"display_name":"Aluno Cinco","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'resp@example.test', '{"display_name":"Resp Legal","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000f1', 'externo@example.test', '{"display_name":"Externo","birth_date":"1981-01-01"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'menor1@example.test', jsonb_build_object('display_name', 'Menor Um', 'birth_date', (current_date - interval '9 years')::date::text, 'dependent', true));
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a9');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'fs-um', '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'fs-dois', '00000000-0000-0000-0000-0000000000a2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000a2', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'student', 'suspended'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b4', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b5', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved');
insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae');
insert into public.guardian_consents (academy_id, minor_user_id, guardian_user_id, status, verified_by, verified_at, document_checked, consent_photos, consent_text_version) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, true, 'rascunho-2026-11');
-- P1 visible, P2 hidden, P3 expired (all in ac01, author b1); P4 visible in ac02
insert into public.feed_posts (id, academy_id, author_user_id, caption, image, mime, width, height, status, client_key, created_at, expires_at) values
 ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'post visivel', decode('ffd8ffe000104a46', 'hex'), 'image/jpeg', 100, 100, 'visible', gen_random_uuid(), now(), now() + interval '30 days'),
 ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'post oculto', decode('ffd8ffe000104a46', 'hex'), 'image/jpeg', 100, 100, 'hidden', gen_random_uuid(), now(), now() + interval '30 days'),
 ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'post vencido', decode('ffd8ffe000104a46', 'hex'), 'image/jpeg', 100, 100, 'visible', gen_random_uuid(), now() - interval '31 days', now() - interval '1 day'),
 ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000a2', 'post da outra', decode('ffd8ffe000104a46', 'hex'), 'image/jpeg', 100, 100, 'visible', gen_random_uuid(), now(), now() + interval '30 days');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

-- 1. Reactions: on/off, one per person
select is((select public.toggle_feed_reaction('00000000-0000-0000-0000-0000000000f1')), true, 'aluno reage (Osu)');
select is((select reactions from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'post visivel'), 1, 'o contador mostra 1');
select is((select reacted_by_me from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'post visivel'), true, 'e que eu reagi');
select is((select public.toggle_feed_reaction('00000000-0000-0000-0000-0000000000f1')), false, 'reagir de novo desfaz');
select is((select reactions from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'post visivel'), 0, 'contador volta a 0');
select public.toggle_feed_reaction('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$select public.toggle_feed_reaction('00000000-0000-0000-0000-0000000000f2')$$, '42501', null, 'post oculto nao recebe reacao');
select throws_ok($$select public.toggle_feed_reaction('00000000-0000-0000-0000-0000000000f3')$$, '42501', null, 'post vencido nao recebe reacao');
select throws_ok($$select public.toggle_feed_reaction('00000000-0000-0000-0000-0000000000f4')$$, '42501', null, 'post de outra academia nao recebe reacao');
select throws_ok($$select count(*) from public.feed_reactions$$, '42501', null, 'sem leitura direta da tabela de reacoes');
select throws_ok($$select count(*) from public.feed_comments$$, '42501', null, 'sem leitura direta da tabela de comentarios');

-- 2. Comments: adult members, text checks, idempotent
select lives_ok($$select public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', 'parabens pelo treino (teste)', '22222222-2222-2222-2222-222222222222')$$, 'aluno comenta');
select is((select public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', 'parabens pelo treino (teste)', '22222222-2222-2222-2222-222222222222')),
          (select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') where body = 'parabens pelo treino (teste)'), 'mesma chave devolve o mesmo comentario');
select is((select count(*)::int from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1')), 1, 'sem duplicar');
select throws_ok($$select public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', '   ', gen_random_uuid())$$, '22023', null, 'comentario vazio');
select throws_ok($$select public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', repeat('x', 301), gen_random_uuid())$$, '22023', null, 'comentario acima de 300 caracteres');
select throws_ok($$select public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', 'oi', null)$$, '22023', null, 'sem chave de idempotencia');
select throws_ok($$select public.add_feed_comment('00000000-0000-0000-0000-0000000000f2', 'oi', gen_random_uuid())$$, '42501', null, 'post oculto nao recebe comentario');
select throws_ok($$select public.add_feed_comment('00000000-0000-0000-0000-0000000000f4', 'oi', gen_random_uuid())$$, '42501', null, 'post de outra academia nao recebe comentario');
select is((select comments from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'post visivel'), 1, 'o feed mostra 1 comentario');

-- 3. People who may not interact or read
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', 'oi', gen_random_uuid())$$, '42501', null, 'quem e de fora nao comenta');
select throws_ok($$select * from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'nem le');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select throws_ok($$select public.toggle_feed_reaction('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'membro suspenso nao reage');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', 'oi', gen_random_uuid())$$, '42501', null, 'responsavel nao comenta');
select throws_ok($$select * from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'responsavel nao le comentarios');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok($$select public.toggle_feed_reaction('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'menor nao reage');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select public.toggle_feed_reaction('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'super admin nao reage');
select throws_ok($$select * from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'super admin nao le comentarios');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$select * from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'gestor de outra academia nao le');

-- 4. Moderation: report hides the comment for everyone except its author and the manager
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
select throws_ok($$select public.report_feed_comment((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1), 'x')$$, '22023', null, 'motivo curto demais');
select lives_ok($$select public.report_feed_comment((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1), 'ofensivo (teste)')$$, 'outro membro denuncia');
select is((select count(*)::int from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1')), 0, 'o comentario denunciado some para os demais');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}', true);
select is((select count(*)::int from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1')), 0, 'e para outro membro tambem');
select is((select comments from public.list_feed('00000000-0000-0000-0000-00000000ac01') where caption = 'post visivel'), 0, 'o contador nao conta o oculto');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1')), 1, 'o autor ainda ve o proprio comentario');
select throws_ok($$select public.report_feed_comment((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1), 'meu proprio')$$, '42501', null, 'ninguem denuncia o proprio comentario');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_comment_reports((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1))), 1, 'o gestor ve o motivo');
select lives_ok($$select public.restore_feed_comment((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1))$$, 'o gestor devolve o comentario');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}', true);
select is((select count(*)::int from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1')), 1, 'devolvido: todos veem de novo');
select throws_ok($$select public.restore_feed_comment((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1))$$, '42501', null, 'so o gestor devolve');
select throws_ok($$select public.delete_feed_comment((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1))$$, '42501', null, 'outro membro nao apaga');
select throws_ok($$select * from public.list_comment_reports((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1))$$, '42501', null, 'so o gestor le as denuncias');

-- 5. Deleting: the author and the manager
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok($$select public.delete_feed_comment((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1))$$, 'o autor apaga o proprio comentario');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
select public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', 'segundo (teste)', gen_random_uuid());
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.delete_feed_comment((select id from public.list_feed_comments('00000000-0000-0000-0000-0000000000f1') limit 1))$$, 'o gestor apaga qualquer comentario');

-- 6. Daily limit: 30 comments per person
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}', true);
select lives_ok($$select count(public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', 'c' || g, gen_random_uuid())) from generate_series(1, 30) g$$, '30 comentarios no dia');
select throws_ok($$select public.add_feed_comment('00000000-0000-0000-0000-0000000000f1', 'a mais', gen_random_uuid())$$, '22023', null, 'o 31o e recusado');

-- 7. Audit never holds the text; reactions and comments die with the photo
reset role;
select is((select count(*)::int from public.audit_events where action like 'feed.comment%' and metadata::text like '%teste%'), 0, 'a auditoria nao guarda o texto');
select cmp_ok((select count(*)::int from public.audit_events where action like 'feed.comment%'), '>', 5, 'mas registra quem comentou, denunciou, devolveu e apagou');
delete from public.feed_posts where id = '00000000-0000-0000-0000-0000000000f1';
select is((select count(*)::int from public.feed_comments where post_id = '00000000-0000-0000-0000-0000000000f1') + (select count(*)::int from public.feed_reactions where post_id = '00000000-0000-0000-0000-0000000000f1'), 0, 'apagar a foto leva reacoes e comentarios');

select * from finish();
rollback;
