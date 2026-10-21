-- US-019: medals computed from validated, non-revoked attendance (test thresholds). Synthetic data only.
begin;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a9', 'admin@example.test', '{"display_name":"Super Admin","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b3', 'aluno3@example.test', '{"display_name":"Aluno Tres","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'resp@example.test', '{"display_name":"Resp Legal","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000e2', 'outro@example.test', '{"display_name":"Outro Responsavel","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000f1', 'externo@example.test', '{"display_name":"Externo","birth_date":"1981-01-01"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'menor1@example.test', jsonb_build_object('display_name', 'Menor Um', 'birth_date', (current_date - interval '9 years')::date::text, 'dependent', true));
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a9');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'md-um', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved');
insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae');
insert into public.guardian_consents (id, academy_id, minor_user_id, guardian_user_id, status, verified_by, verified_at, document_checked, consent_photos, consent_text_version) values
 ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'verified', '00000000-0000-0000-0000-0000000000a1', now(), true, false, 'rascunho-2026-11');
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-00000000ac01', 'Turma Medalhas', '00000000-0000-0000-0000-0000000000a1');

-- Series S: 10 lessons, one every 7 days (10 consecutive weeks), the latest yesterday. Series E: 3 lessons 3, 4 and 5 days ago.
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at)
  select ('00000000-0000-0000-0000-00000000' || lpad(k::text, 4, '0'))::uuid, '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b9',
         now() - make_interval(days => (9 - k) * 7 + 1), now() - make_interval(days => (9 - k) * 7 + 1) + interval '1 hour'
  from generate_series(0, 9) k;
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at)
  select ('00000000-0000-0000-0000-0000000e' || lpad(k::text, 4, '0'))::uuid, '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b9',
         now() - make_interval(days => k) + interval '2 hours', now() - make_interval(days => k) + interval '3 hours'
  from generate_series(3, 5) k;
-- b1 and the minor d1 attend all of S; b3 attends 9 of S and its 10th is REVOKED; b2 attends E.
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
  select '00000000-0000-0000-0000-00000000ac01', s.id, u.id, 'teacher', 'validated', '00000000-0000-0000-0000-0000000000a1', now()
  from public.sessions s cross join (values ('00000000-0000-0000-0000-0000000000b1'::uuid), ('00000000-0000-0000-0000-0000000000d1'::uuid)) u(id)
  where s.id::text like '00000000-0000-0000-0000-00000000%' and s.id::text not like '00000000-0000-0000-0000-0000000e%';
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
  select '00000000-0000-0000-0000-00000000ac01', s.id, '00000000-0000-0000-0000-0000000000b3', 'teacher', 'validated', '00000000-0000-0000-0000-0000000000a1', now()
  from public.sessions s where s.id::text like '00000000-0000-0000-0000-00000000%' and s.id::text not like '00000000-0000-0000-0000-0000000e%'
    and s.id <> '00000000-0000-0000-0000-000000000009';
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at, revoked_by, revoked_at, revoked_reason) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000b3', 'teacher', 'revoked', null, null, '00000000-0000-0000-0000-0000000000a1', now(), 'engano de teste');
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at)
  select '00000000-0000-0000-0000-00000000ac01', s.id, '00000000-0000-0000-0000-0000000000b2', 'teacher', 'validated', '00000000-0000-0000-0000-0000000000a1', now()
  from public.sessions s where s.id::text like '00000000-0000-0000-0000-0000000e%';
-- Finished attendance challenge (last 35 days) with b1 and b2, and a finished TRAINING challenge with b2 only
insert into public.challenges (id, academy_id, created_by, title, metric, points_per_unit, starts_on, ends_on, min_participants, activated_at) values
 ('00000000-0000-0000-0000-0000000000ce', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'Desafio de presenca (teste)', 'attendance', 1,
   (now() at time zone 'America/Sao_Paulo')::date - 35, (now() at time zone 'America/Sao_Paulo')::date - 1, 3, now() - interval '36 days'),
 ('00000000-0000-0000-0000-0000000000cf', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'Desafio de treino (teste)', 'training', 1,
   (now() at time zone 'America/Sao_Paulo')::date - 35, (now() at time zone 'America/Sao_Paulo')::date - 1, 3, now() - interval '36 days');
insert into public.challenge_participants (challenge_id, academy_id, user_id) values
 ('00000000-0000-0000-0000-0000000000ce', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-0000000000ce', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2'),
 ('00000000-0000-0000-0000-0000000000cf', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2');
insert into public.challenge_entries (academy_id, challenge_id, user_id, occurred_at, units) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000cf', '00000000-0000-0000-0000-0000000000b2', now() - interval '3 days', 5);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

-- 1. The medals of one person
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'attendance_10'), 1, '10 presencas validadas dao a medalha');
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code in ('attendance_25', 'attendance_50', 'attendance_100')), 0, 'sem as medalhas maiores');
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'streak_4'), 1, '10 semanas seguidas dao a de 4 semanas');
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'streak_12'), 0, 'mas nao a de 12');
select is((select earned_on from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'attendance_10'),
          ((now() - interval '1 day') at time zone 'America/Sao_Paulo')::date, 'a data e a da 10a presenca');
select cmp_ok((select earned_on from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'streak_4'), '<', current_date, 'a medalha de 4 semanas e datada no passado');
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'challenge_winner'), 1, 'vencedor do desafio de presenca');
select is((select challenge_id from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'challenge_winner'), '00000000-0000-0000-0000-0000000000ce'::uuid, 'ligada ao desafio');
select ok(position('Desafio de presenca (teste)' in (select title from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'challenge_winner')) > 0, 'com o nome do desafio');

-- 2. Revoked attendance does not count; a loser or a self-reported challenge gives nothing
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code like 'attendance_%'), 0, '9 presencas validadas e 1 revogada: sem a medalha de 10');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01')), 0, 'quem perdeu o desafio de presenca e venceu o de treino informado nao ganha');

-- 3. Who may see
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select * from public.my_medals('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'quem e de fora nao ve');
select throws_ok($$select * from public.list_academy_medals('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'nem o quadro');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select * from public.my_medals('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'super admin nao ve');
select throws_ok($$select * from public.list_academy_medals('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'nem o quadro');
select throws_ok($$select * from public.medals_of('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'a funcao interna nao e chamavel');

-- 4. The academy board: adults for every member; minors only for the manager
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select cmp_ok((select count(*)::int from public.list_academy_medals('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b1'), '>=', 3, 'o aluno ve as medalhas dos adultos');
select is((select count(*)::int from public.list_academy_medals('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000d1'), 0, 'mas nunca as do menor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select cmp_ok((select count(*)::int from public.list_academy_medals('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000d1'), '>=', 2, 'o gestor ve as do menor');

-- 5. The legal guardian sees the child's medals
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select cmp_ok((select count(*)::int from public.dependent_medals('00000000-0000-0000-0000-0000000000d1') where code = 'attendance_10'), '=', 1, 'o responsavel ve a medalha do filho');
select is((select academy_name from public.dependent_medals('00000000-0000-0000-0000-0000000000d1') where code = 'attendance_10'), 'Academia Um', 'com o nome da academia');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select throws_ok($$select * from public.dependent_medals('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'outro responsavel nao ve');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select * from public.dependent_medals('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'outro membro nao ve');

-- 6. Revoking the consent hides the child's medals from the guardian; revoking an attendance removes the medal
reset role;
update public.guardian_consents set revoked_at = now() where id = '00000000-0000-0000-0000-0000000000c0';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from public.dependent_medals('00000000-0000-0000-0000-0000000000d1')), 0, 'consentimento revogado: o responsavel nao ve mais');
reset role;
update public.attendances set status = 'revoked', validated_by = null, validated_at = null, revoked_by = '00000000-0000-0000-0000-0000000000a1', revoked_at = now(), revoked_reason = 'engano de teste'
  where user_id = '00000000-0000-0000-0000-0000000000b1' and session_id = '00000000-0000-0000-0000-000000000009';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'attendance_10'), 0, 'presenca revogada: a medalha deixa de existir');
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'challenge_winner'), 1, 'e o desafio continua valendo (4 contra 3)');
select is((select count(*)::int from public.my_medals('00000000-0000-0000-0000-00000000ac01') where code = 'streak_4'), 1, 'a sequencia de semanas continua (9 semanas)');

select * from finish();
rollback;
