-- US-014: challenges. Synthetic data; expected numbers are worked out by hand in the comments.
begin;
select plan(82);

-- Fixtures (as postgres). Adults get a private birth date (age gate); u6 is a minor who somehow became a member.
-- m1 manager | i1 instructor | s1..s5 students | u6 minor student | p1 pending | o1 outsider | x1 manager of another academy
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000000000' || n.id)::uuid, n.email
  from (values ('b1','gestor@example.test'),('c1','instrutor@example.test'),
               ('d1','aluno1@example.test'),('d2','aluno2@example.test'),('d3','aluno3@example.test'),('d4','aluno4@example.test'),('d5','aluno5@example.test'),
               ('d6','menor@example.test'),('d7','pendente@example.test'),('f1','externo@example.test'),('e1','gestor2@example.test')) as n(id, email);
insert into public.profile_private (user_id, birth_date)
  select u.id, case when u.email = 'menor@example.test' then (current_date - interval '12 years')::date else date '1990-01-01' end
  from auth.users u where u.email in ('gestor@example.test','instrutor@example.test','aluno1@example.test','aluno2@example.test','aluno3@example.test',
    'aluno4@example.test','aluno5@example.test','menor@example.test','pendente@example.test','externo@example.test','gestor2@example.test')
  on conflict (user_id) do nothing;
update public.profiles set display_name = 'Aluno Um' where id = '00000000-0000-0000-0000-0000000000d1';
update public.profiles set display_name = 'Aluno Dois' where id = '00000000-0000-0000-0000-0000000000d2';
update public.profiles set display_name = 'Aluno Tres' where id = '00000000-0000-0000-0000-0000000000d3';
update public.profiles set display_name = 'Aluno Quatro' where id = '00000000-0000-0000-0000-0000000000d4';
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'desafio-um', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'desafio-dois', '00000000-0000-0000-0000-0000000000e1');
insert into public.memberships (academy_id, user_id, role, status)
  select '00000000-0000-0000-0000-00000000ac01', ('00000000-0000-0000-0000-0000000000' || m.id)::uuid, m.role::public.membership_role, m.st::public.membership_status
  from (values ('b1','manager','approved'),('c1','instructor','approved'),
               ('d1','student','approved'),('d2','student','approved'),('d3','student','approved'),('d4','student','approved'),('d5','student','approved'),
               ('d6','student','approved'),('d7','student','pending')) as m(id, role, st);
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e1', 'manager', 'approved');
-- A class, with a lesson 10 hours ago and a VALIDATED attendance of s1 (so s1's entry at that time is "verified")
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-00000000ac01', 'Turma Desafio', '00000000-0000-0000-0000-0000000000c1');
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at) values
 ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b9', now() - interval '10 hours', now() - interval '9 hours'),
 ('00000000-0000-0000-0000-000000005a02', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b9', now() - interval '6 hours', now() - interval '5 hours');
insert into public.attendances (academy_id, session_id, user_id, source, status, validated_by, validated_at, revoked_by, revoked_at, revoked_reason) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d1', 'teacher', 'validated', '00000000-0000-0000-0000-0000000000c1', now(), null, null, null),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-000000005a02', '00000000-0000-0000-0000-0000000000d1', 'teacher', 'validated', '00000000-0000-0000-0000-0000000000c1', now(), null, null, null),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-0000000000d2', 'manual', 'pending', null, null, null, null, null),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-000000005a02', '00000000-0000-0000-0000-0000000000d3', 'manual', 'revoked', null, null, '00000000-0000-0000-0000-0000000000c1', now(), 'motivo de teste');

set local role authenticated;

-- Creating ------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', '  Maratona de treinos  ', 'quem treina mais', 'training', 5, null, 1, current_date, current_date + 30, 3, true, '60606060-6060-6060-6060-606060606060')$$, 'aluno cria desafio de treino (5 pontos por treino, 1 por dia)');
select is((select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'Maratona de treinos', 'quem treina mais', 'training', 5, null, 1, current_date, current_date + 30, 3, true, '60606060-6060-6060-6060-606060606060')),
          (select id from public.challenges where title = 'Maratona de treinos'), 'criacao idempotente');
select is((select count(*)::int from public.challenges), 1, 'sem desafio duplicado');
select is((select state from public.list_challenges('00000000-0000-0000-0000-00000000ac01') where title = 'Maratona de treinos'), 'open', 'comeca aguardando participantes');
select is((select participants from public.list_challenges('00000000-0000-0000-0000-00000000ac01') where title = 'Maratona de treinos'), 1, 'o criador ja entra (opt-in na criacao)');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'X1', null, 'training', 5, null, null, current_date, current_date + 5, 2, true, gen_random_uuid())$$, '22023', null, 'minimo de participantes abaixo de 3 rejeitado');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'X2', null, 'training', 5, null, null, current_date, current_date + 5, 51, true, gen_random_uuid())$$, '22023', null, 'minimo acima de 50 rejeitado');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'X3', null, 'training', 0, null, null, current_date, current_date + 5, 3, true, gen_random_uuid())$$, '22023', null, 'pontos 0 rejeitado (a academia define os pontos)');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'X4', null, 'training', 5, null, null, current_date - 1, current_date + 5, 3, true, gen_random_uuid())$$, '22023', null, 'inicio no passado rejeitado');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'X5', null, 'training', 5, null, null, current_date + 5, current_date + 1, 3, true, gen_random_uuid())$$, '22023', null, 'fim antes do inicio rejeitado');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'X6', null, 'training', 5, null, null, current_date, current_date + 400, 3, true, gen_random_uuid())$$, '22023', null, 'duracao acima de 366 dias rejeitada');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'X7', null, 'technique_reps', 1, null, null, current_date, current_date + 5, 3, true, gen_random_uuid())$$, '22023', null, 'desafio de golpe exige a tecnica');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'X8', null, 'training', 5, (select id from public.techniques where name = 'Tesoura' and academy_id is null), null, current_date, current_date + 5, 3, true, gen_random_uuid())$$, '22023', null, 'tecnica so em desafio de golpe');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'X9', null, 'attendance', 5, null, 3, current_date, current_date + 5, 3, true, gen_random_uuid())$$, '22023', null, 'limite diario nao se aplica a presenca (automatica)');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'XA', null, 'nada', 5, null, null, current_date, current_date + 5, 3, true, gen_random_uuid())$$, '22023', null, 'tipo desconhecido rejeitado');
select lives_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'Presenca do mes', null, 'attendance', 10, null, null, current_date - 0, current_date + 30, 3, false, gen_random_uuid())$$, 'segundo desafio (presenca validada, automatico)');
select lives_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'Mil tesouras', null, 'technique_reps', 1, (select id from public.techniques where name = 'Tesoura' and academy_id is null), 100, current_date, current_date + 30, 3, true, gen_random_uuid())$$, 'terceiro desafio (golpe: repeticoes da Tesoura, ate 100 por dia)');
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'Quarto', null, 'training', 5, null, null, current_date, current_date + 5, 3, true, gen_random_uuid())$$, '22023', null, 'no maximo 3 desafios em aberto por criador');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'Externo', null, 'training', 5, null, null, current_date, current_date + 5, 3, true, gen_random_uuid())$$, '42501', null, 'quem nao e membro nao cria');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d6","role":"authenticated"}', true);
select throws_ok($$select public.create_challenge('00000000-0000-0000-0000-00000000ac01', 'Menor', null, 'training', 5, null, null, current_date, current_date + 5, 3, true, gen_random_uuid())$$, '22023', null, 'menor de idade nao cria');
select throws_ok($$insert into public.challenges (academy_id, created_by, title, metric, points_per_unit, starts_on, ends_on, min_participants) values ('00000000-0000-0000-0000-00000000ac01','00000000-0000-0000-0000-0000000000d6','Direto','training',1,current_date,current_date,3)$$, '42501', null, 'sem INSERT direto em challenges');

-- Joining and automatic activation ("ja comeca") -----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d6","role":"authenticated"}', true);
select throws_ok($$select public.join_challenge((select id from public.challenges where title = 'Maratona de treinos'))$$, '22023', null, 'menor de idade nao participa');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d7","role":"authenticated"}', true);
select throws_ok($$select public.join_challenge((select id from public.challenges where title = 'Maratona de treinos'))$$, '42501', null, 'filiacao pendente nao participa');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.join_challenge((select id from public.challenges where title = 'Maratona de treinos'))$$, '42501', null, 'externo nao participa');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.join_challenge((select id from public.challenges where title = 'Maratona de treinos'))$$, '42501', null, 'gestor de outra academia nao participa');
select throws_ok($$select * from public.list_challenges('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'nem lista os desafios de outra academia');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select is((select public.join_challenge((select id from public.challenges where title = 'Maratona de treinos'))), 'open', 'segundo participante: ainda aguardando (2 de 3)');
select is((select public.join_challenge((select id from public.challenges where title = 'Maratona de treinos'))), 'open', 'entrar de novo e idempotente');
select throws_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Maratona de treinos'), current_date, '07:00', 1, null, gen_random_uuid())$$, '22023', null, 'antes de ativar nao se registra treino');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select is((select public.join_challenge((select id from public.challenges where title = 'Maratona de treinos'))), 'active', 'terceiro participante: o desafio ativa e ja comeca');
select ok((select activated_at is not null from public.challenges where title = 'Maratona de treinos'), 'ativacao registrada');
select is((select participants from public.list_challenges('00000000-0000-0000-0000-00000000ac01') where title = 'Maratona de treinos'), 3, 'a lista mostra quantos participam');

-- Time passes: the challenge is moved back 5 days (it was activated earlier), so entries on past days are valid
reset role;
update public.challenges set starts_on = current_date - 5 where title = 'Maratona de treinos';
set local role authenticated;
-- Entries: self-reported day and time; they count right away -------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Maratona de treinos'), (now() at time zone 'America/Sao_Paulo' - interval '10 hours')::date, (now() at time zone 'America/Sao_Paulo' - interval '9 hours 30 minutes')::time, 1, 'aula da noite', '70707070-7070-7070-7070-707070707070')$$, 's1 registra um treino dentro de uma aula em que teve presenca validada');
select is((select public.add_challenge_entry((select id from public.challenges where title = 'Maratona de treinos'), (now() at time zone 'America/Sao_Paulo' - interval '10 hours')::date, (now() at time zone 'America/Sao_Paulo' - interval '9 hours 30 minutes')::time, 1, 'aula da noite', '70707070-7070-7070-7070-707070707070')),
          (select id from public.challenge_entries where client_key = '70707070-7070-7070-7070-707070707070'), 'registro idempotente');
select is((select count(*)::int from public.challenge_entries), 1, 'sem registro duplicado');
select throws_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Maratona de treinos'), (now() at time zone 'America/Sao_Paulo' - interval '9 hours')::date, (now() at time zone 'America/Sao_Paulo' - interval '9 hours')::time, 1, null, gen_random_uuid())$$, '22023', null, 'limite de 1 por dia: o segundo treino do mesmo dia e rejeitado');
select throws_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Maratona de treinos'), current_date + 1, '07:00', 1, null, gen_random_uuid())$$, '22023', null, 'dia futuro rejeitado');
select throws_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Maratona de treinos'), current_date - 40, '07:00', 1, null, gen_random_uuid())$$, '22023', null, 'dia antes do inicio do desafio rejeitado');
select throws_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Presenca do mes'), current_date, '07:00', 1, null, gen_random_uuid())$$, '42501', null, 'desafio de presenca nao tem registro manual (e s1 nem participa)');
select throws_ok($$insert into public.challenge_entries (academy_id, challenge_id, user_id, occurred_at, units) values ('00000000-0000-0000-0000-00000000ac01', (select id from public.challenges limit 1), '00000000-0000-0000-0000-0000000000d1', now(), 99)$$, '42501', null, 'sem INSERT direto em challenge_entries');
select is((select verified from public.my_challenge_entries((select id from public.challenges where title = 'Maratona de treinos')) limit 1), true, 's1 ve o proprio registro com o selo confirmado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select lives_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Maratona de treinos'), (now() at time zone 'America/Sao_Paulo' - interval '30 hours')::date, '07:00', 1, null, gen_random_uuid())$$, 's2 registra um treino de ontem (sem presenca validada: vale ponto, nao confirmado)');
select lives_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Maratona de treinos'), (now() at time zone 'America/Sao_Paulo' - interval '54 hours')::date, '07:00', 1, null, gen_random_uuid())$$, 's2 registra outro treino, de 2 dias atras');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select throws_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Maratona de treinos'), current_date, '07:00', 1, null, gen_random_uuid())$$, '42501', null, 'quem nao participa nao registra');

-- Ranking: full, for participants only; points = entries x 5 -----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select is((select count(*)::int from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos'))), 3, 'ranking completo com os 3 participantes');
select is((select points from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos')) where display_name = 'Aluno Dois'), 10::bigint, 's2: 2 treinos x 5 = 10 pontos');
select is((select points from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos')) where display_name = 'Aluno Um'), 5::bigint, 's1: 1 treino x 5 = 5 pontos');
select is((select display_name from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos')) where rank = 1), 'Aluno Dois', 'lider: Aluno Dois');
select is((select verified_entries from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos')) where display_name = 'Aluno Um'), 1::bigint, 'o treino de s1 e confirmado (dentro de aula com presenca validada)');
select is((select verified_entries from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos')) where display_name = 'Aluno Dois'), 0::bigint, 'os de s2 contam, mas nao estao confirmados');
select is((select points from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos')) where display_name = 'Aluno Tres'), 0::bigint, 's3 sem registros: 0 pontos (aparece no ranking)');
select is((select count(*)::int from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos')) where is_me), 1, 'cada pessoa se reconhece no ranking');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select throws_ok($$select * from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos'))$$, '42501', null, 'quem nao participa nao ve o ranking');
select is((select count(*)::int from public.my_challenge_entries((select id from public.challenges where title = 'Maratona de treinos'))), 0, 'e cada pessoa so lista os proprios registros');
select is((select count(*)::int from public.challenge_entries) + (select count(*)::int from public.challenge_participants), 0, 'nem os registros nem a lista de participantes dos outros');

-- Voiding, leaving, moderation ----------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select lives_ok($$select public.void_challenge_entry((select id from public.challenge_entries where user_id = '00000000-0000-0000-0000-0000000000d2' order by occurred_at limit 1))$$, 's2 anula o proprio registro');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select is((select points from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos')) where display_name = 'Aluno Dois'), 5::bigint, 'registro anulado nao pontua');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select throws_ok($$select public.void_challenge_entry((select id from public.challenge_entries limit 1))$$, '42501', null, 'colega nao anula registro alheio');
select throws_ok($$select * from public.list_challenge_entries((select id from public.challenges where title = 'Maratona de treinos'))$$, '42501', null, 'participante comum nao lista os registros dos outros');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_challenge_entries((select id from public.challenges where title = 'Maratona de treinos'))), 3, 'gestor lista todos os registros do desafio para moderar');
select lives_ok($$select public.void_challenge_entry((select id from public.list_challenge_entries((select id from public.challenges where title = 'Maratona de treinos')) where display_name = 'Aluno Um' limit 1))$$, 'gestor modera: anula registro de qualquer um (auditado)');
select ok((select count(*) from public.audit_events where action = 'challenge.void_entry') = 1, 'moderacao registrada na auditoria');
select is((select count(*)::int from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos'))), 3, 'gestor ve o ranking completo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select lives_ok($$select public.leave_challenge((select id from public.challenges where title = 'Maratona de treinos'))$$, 's3 sai do desafio');
select throws_ok($$select * from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos'))$$, '42501', null, 'quem saiu nao ve mais o ranking');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.challenge_ranking((select id from public.challenges where title = 'Maratona de treinos'))), 2, 'e sai do ranking dos outros; o desafio continua ativo');

-- Attendance challenge: only VALIDATED attendance scores (pending / revoked never) ------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select is((select public.join_challenge((select id from public.challenges where title = 'Presenca do mes'))), 'open', 'presenca do mes: 1 de 3');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select public.join_challenge((select id from public.challenges where title = 'Presenca do mes'))), 'open', 'presenca do mes: 2 de 3');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select is((select public.join_challenge((select id from public.challenges where title = 'Presenca do mes'))), 'active', 'presenca do mes ativa com 3');
select is((select points from public.challenge_ranking((select id from public.challenges where title = 'Presenca do mes')) where display_name = 'Aluno Um'), 20::bigint, 's1: 2 presencas validadas x 10 = 20');
select is((select points from public.challenge_ranking((select id from public.challenges where title = 'Presenca do mes')) where display_name = 'Aluno Dois'), 0::bigint, 's2: presenca pendente nao pontua');
select is((select points from public.challenge_ranking((select id from public.challenges where title = 'Presenca do mes')) where display_name = 'Aluno Tres'), 0::bigint, 's3: presenca revogada nao pontua');

-- Technique reps with a daily cap -----------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select is((select public.join_challenge((select id from public.challenges where title = 'Mil tesouras'))), 'open', 'mil tesouras: 2 de 3 (o criador ja entrou)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select is((select public.join_challenge((select id from public.challenges where title = 'Mil tesouras'))), 'active', 'mil tesouras ativa com 3');
select lives_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Mil tesouras'), (now() at time zone 'America/Sao_Paulo' - interval '3 hours')::date, '06:00', 60, null, gen_random_uuid())$$, '60 repeticoes de Tesoura');
select throws_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Mil tesouras'), (now() at time zone 'America/Sao_Paulo' - interval '3 hours')::date, '06:05', 50, null, gen_random_uuid())$$, '22023', null, '60 + 50 passa do limite de 100 por dia');
select throws_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Mil tesouras'), (now() at time zone 'America/Sao_Paulo' - interval '3 hours')::date, '06:10', 0, null, gen_random_uuid())$$, '22023', null, 'zero repeticoes rejeitado');

-- Cancelling -------------------------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select throws_ok($$select public.cancel_challenge((select id from public.challenges where title = 'Mil tesouras'), 'nao sou o criador')$$, '42501', null, 'quem nao criou nem gerencia nao cancela');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.cancel_challenge((select id from public.challenges where title = 'Mil tesouras'), 'desafio duplicado')$$, 'gestor cancela');
select is((select state from public.list_challenges('00000000-0000-0000-0000-00000000ac01') where title = 'Mil tesouras'), 'cancelled', 'desafio cancelado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select throws_ok($$select public.add_challenge_entry((select id from public.challenges where title = 'Mil tesouras'), current_date, '07:00', 5, null, gen_random_uuid())$$, '22023', null, 'desafio cancelado nao recebe registros');

reset role;
select ok((select count(*) from public.audit_events where action in ('challenge.create', 'challenge.activate', 'challenge.cancel', 'challenge.void_entry')) >= 7, 'criacao, ativacao, cancelamento e moderacao auditados');

select * from finish();
rollback;
