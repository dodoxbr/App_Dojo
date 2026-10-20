-- US-006: private diary. Synthetic data only.
begin;
select plan(36);

-- Fixtures (as postgres)
-- a1 platform admin | m1 manager ac01 | i1 instructor ac01 | s1, s2 students ac01 | x1 student ac02 | n1 no academy
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test'),
 ('00000000-0000-0000-0000-0000000000c1', 'instrutor@example.test'),
 ('00000000-0000-0000-0000-0000000000d1', 'aluno1@example.test'),
 ('00000000-0000-0000-0000-0000000000d2', 'aluno2@example.test'),
 ('00000000-0000-0000-0000-0000000000e1', 'outra@example.test'),
 ('00000000-0000-0000-0000-0000000000f1', 'sem@example.test');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'diario-um', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'diario-dois', '00000000-0000-0000-0000-0000000000e1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e1', 'manager', 'approved');
insert into public.techniques (id, academy_id, name, category) values
 ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-00000000ac01', 'Tecnica Diario Um', 'Teste'),
 ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-00000000ac02', 'Tecnica Diario Dois', 'Teste');

-- a pre-existing entry of s1 with a known id, to test access by others
insert into public.training_logs (id, user_id, notes) values
 ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-0000000000d1', 'registro ja existente de s1');

set local role authenticated;

-- s1 writes entries ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok($$select public.save_training_log('00000000-0000-0000-0000-00000000ac01', now(), 'treino de teste', array['f0085f40-8d58-5777-aac6-01c39cd03890', '00000000-0000-0000-0000-0000000000a9']::uuid[], '44444444-4444-4444-4444-444444444444')$$, 's1 salva registro com tecnicas');
select is((select count(*)::int from public.training_log_techniques), 2, 'vinculo com duas tecnicas (global e da academia)');
select is((select public.save_training_log('00000000-0000-0000-0000-00000000ac01', now(), 'treino de teste', array['f0085f40-8d58-5777-aac6-01c39cd03890']::uuid[], '44444444-4444-4444-4444-444444444444')),
          (select id from public.training_logs where client_key = '44444444-4444-4444-4444-444444444444'), 'repetir a mesma chave devolve o mesmo registro');
select is((select count(*)::int from public.training_logs), 2, 'sem registro duplicado');
select is((select count(*)::int from public.training_log_techniques), 2, 'repeticao nao altera os vinculos');
select lives_ok($$select public.save_training_log(null, now() - interval '2 days', 'treino fora da academia', '{}'::uuid[], '55555555-5555-5555-5555-555555555555')$$, 'treino pessoal (sem academia) permitido');
select is((select visibility from public.training_logs where client_key = '55555555-5555-5555-5555-555555555555'), 'private', 'visibilidade privada por padrao');

-- validation and isolation on write
select throws_ok($$select public.save_training_log('00000000-0000-0000-0000-00000000ac02', now(), 'x', '{}'::uuid[], gen_random_uuid())$$, '42501', null, 'nao registra em academia onde nao e membro');
select throws_ok($$select public.save_training_log('00000000-0000-0000-0000-00000000ac01', now(), 'x', array['00000000-0000-0000-0000-0000000000b9']::uuid[], gen_random_uuid())$$, '42501', null, 'nao vincula tecnica de outra academia');
select is((select count(*)::int from public.training_logs), 3, 'falha ao vincular desfaz o registro inteiro (atomico)');
select throws_ok($$select public.save_training_log(null, now() + interval '3 days', 'x', '{}'::uuid[], gen_random_uuid())$$, '22023', null, 'data muito no futuro rejeitada');
select throws_ok($$select public.save_training_log(null, now(), repeat('a', 10001), '{}'::uuid[], gen_random_uuid())$$, '22023', null, 'anotacao longa rejeitada');
select throws_ok($$select public.save_training_log(null, now(), 'x', '{}'::uuid[], null)$$, '22023', null, 'chave de idempotencia obrigatoria');
select throws_ok($$insert into public.training_logs (user_id, notes) values ('00000000-0000-0000-0000-0000000000d2', 'em nome de outro')$$, '42501', null, 'nao cria registro em nome de outro usuario');
select throws_ok($$update public.training_logs set visibility = 'shared'$$, '23514', null, 'visibilidade so aceita private (sem compartilhamento ainda)');

-- edit replaces the technique set
select lives_ok($$select public.save_training_log('00000000-0000-0000-0000-00000000ac01', now(), 'editado', array['00000000-0000-0000-0000-0000000000a9']::uuid[], gen_random_uuid(), (select id from public.training_logs where client_key = '44444444-4444-4444-4444-444444444444'))$$, 'edita registro e substitui tecnicas');
select is((select notes from public.training_logs where client_key = '44444444-4444-4444-4444-444444444444'), 'editado', 'anotacao atualizada');
select is((select count(*)::int from public.training_log_techniques where log_id = (select id from public.training_logs where client_key = '44444444-4444-4444-4444-444444444444')), 1, 'vinculos substituidos');

-- s2 cannot touch s1's entries
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select is((select count(*)::int from public.training_logs), 0, 'colega da mesma academia nao le o diario de s1');
select is((select count(*)::int from public.training_log_techniques), 0, 'nem os vinculos');
select throws_ok($$select public.save_training_log(null, now(), 'invasao', '{}'::uuid[], gen_random_uuid(), '00000000-0000-0000-0000-0000000000ee')$$, 'P0002', null, 'editar registro alheio = NOT_FOUND');
select throws_ok($$select public.save_training_log(null, now(), 'invasao', '{}'::uuid[], gen_random_uuid(), '44444444-0000-0000-0000-000000000000')$$, 'P0002', null, 'editar registro inexistente = NOT_FOUND');
select is_empty($$delete from public.training_logs returning id$$, 'nao exclui registro alheio');

-- manager, instructor, outsider and anon: nothing
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.training_logs), 0, 'gestor nao le diario de aluno');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.training_logs), 0, 'instrutor nao le diario de aluno');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from public.training_logs), 0, 'gestor de outra academia nao le');
select is((select count(*)::int from public.platform_settings), 0, 'usuario comum nao le as configuracoes da plataforma');
select throws_ok($$update public.platform_settings set admin_diary_access = false$$, '42501', null, 'usuario comum nao altera configuracoes');
select is((select public.admin_can_read_diaries()), false, 'usuario comum nao e admin do diario');

-- platform admin: test phase switch ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.training_logs where user_id = '00000000-0000-0000-0000-0000000000d1'), 3, 'super admin le os diarios na fase de teste (chave ligada)');
select is((select count(*)::int from public.training_log_techniques where log_id in (select id from public.training_logs where user_id = '00000000-0000-0000-0000-0000000000d1')), 1, 'e os vinculos');
select throws_ok($$update public.platform_settings set admin_diary_access = false$$, '42501', null, 'super admin nao desliga pelo app (so por SQL)');

reset role;
update public.platform_settings set admin_diary_access = false;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.training_logs), 0, 'chave desligada: super admin deixa de ler os diarios');

-- owner still reads own, then deletes (links cascade)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.training_logs), 3, 'dono continua lendo os proprios registros');
select lives_ok($$delete from public.training_logs where client_key = '44444444-4444-4444-4444-444444444444'$$, 'dono exclui o proprio registro');
select is((select count(*)::int from public.training_log_techniques), 0, 'vinculos removidos junto');

select * from finish();
rollback;
