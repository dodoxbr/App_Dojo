-- US-009: curriculum and skill assessments. Synthetic users; uses the real imported catalog.
begin;
select plan(63);

-- Fixtures (as postgres)
-- a1 platform admin | m1 manager ac01 | i1 instructor WITH assess_skills | i2 instructor WITHOUT | s1, s2 students
-- p1 pending | x1 manager ac02 | y1 student ac02 | o1 outsider
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test'),
 ('00000000-0000-0000-0000-0000000000c1', 'instrutor1@example.test'),
 ('00000000-0000-0000-0000-0000000000c2', 'instrutor2@example.test'),
 ('00000000-0000-0000-0000-0000000000d1', 'aluno1@example.test'),
 ('00000000-0000-0000-0000-0000000000d2', 'aluno2@example.test'),
 ('00000000-0000-0000-0000-0000000000d3', 'pendente@example.test'),
 ('00000000-0000-0000-0000-0000000000e1', 'gestor2@example.test'),
 ('00000000-0000-0000-0000-0000000000e2', 'aluno-outra@example.test'),
 ('00000000-0000-0000-0000-0000000000f1', 'externo@example.test');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'trilha-um', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'trilha-dois', '00000000-0000-0000-0000-0000000000e1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c2', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', 'student', 'pending'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000e2', 'student', 'approved');
-- default permissions plus assess_skills only for the instructor role... then i2 is removed from it by design below
insert into public.academy_role_permissions (academy_id, role, permission) values
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'view_roster'),
 ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'validate_attendance');
insert into public.techniques (id, academy_id, name, category) values
 ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-00000000ac01', 'Tecnica Trilha Um', 'Teste'),
 ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-00000000ac02', 'Tecnica Trilha Dois', 'Teste');

set local role authenticated;

-- Curriculum configuration -----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.create_curriculum('00000000-0000-0000-0000-00000000ac01', '  Faixa Branca  ', 'Básico', '99999999-9999-9999-9999-999999999999')$$, 'gestor cria curriculo');
select is((select public.create_curriculum('00000000-0000-0000-0000-00000000ac01', 'Faixa Branca', 'Básico', '99999999-9999-9999-9999-999999999999')),
          (select id from public.curricula where title = 'Faixa Branca'), 'criacao idempotente');
select throws_ok($$select public.create_curriculum('00000000-0000-0000-0000-00000000ac01', 'FAIXA  branca', null, gen_random_uuid())$$, '23505', null, 'titulo ativo duplicado = CONFLICT');
select throws_ok($$insert into public.curricula (academy_id, title) values ('00000000-0000-0000-0000-00000000ac01', 'Direto')$$, '42501', null, 'sem INSERT direto em curricula');
select lives_ok($$select public.add_curriculum_item((select id from public.curricula where title = 'Faixa Branca'), (select id from public.techniques where name = 'Tesoura' and academy_id is null), true)$$, 'gestor adiciona tecnica global');
select is((select public.add_curriculum_item((select id from public.curricula where title = 'Faixa Branca'), (select id from public.techniques where name = 'Tesoura' and academy_id is null), true)),
          (select id from public.curriculum_items where technique_id = (select id from public.techniques where name = 'Tesoura' and academy_id is null)), 'adicionar de novo devolve o mesmo item');
select lives_ok($$select public.add_curriculum_item((select id from public.curricula where title = 'Faixa Branca'), '00000000-0000-0000-0000-0000000000a9', false)$$, 'gestor adiciona tecnica da propria academia (opcional)');
select throws_ok($$select public.add_curriculum_item((select id from public.curricula where title = 'Faixa Branca'), '00000000-0000-0000-0000-0000000000b9', true)$$, '22023', null, 'tecnica de outra academia nao entra na trilha');
select throws_ok($$select public.add_curriculum_item((select id from public.curricula where title = 'Faixa Branca'), gen_random_uuid(), true)$$, '22023', null, 'tecnica inexistente = VALIDATION_ERROR');
select is((select count(*)::int from public.curriculum_items), 2, 'duas tecnicas na trilha');
select throws_ok($$select public.add_curriculum_items_from_level((select id from public.curricula where title = 'Faixa Branca'), 'Nivel Inexistente')$$, '22023', null, 'nivel inexistente = VALIDATION_ERROR');
select lives_ok($$select public.add_curriculum_items_from_level((select id from public.curricula where title = 'Faixa Branca'), 'Básico')$$, 'atalho adiciona as tecnicas do nivel Basico da planilha');
select is((select public.add_curriculum_items_from_level((select id from public.curricula where title = 'Faixa Branca'), 'Básico')), 0, 'repetir o atalho nao adiciona de novo');
select lives_ok($$select public.set_curriculum_item_required((select id from public.curriculum_items where technique_id = (select id from public.techniques where name = 'Tesoura' and academy_id is null)), false)$$, 'gestor torna a tecnica opcional');
select is((select required from public.curriculum_items where technique_id = (select id from public.techniques where name = 'Tesoura' and academy_id is null)), false, 'obrigatoriedade alterada');

reset role;
select is((select count(*)::int from public.curriculum_items where academy_id = '00000000-0000-0000-0000-00000000ac01' and technique_id in (select technique_id from public.technique_sources where level = 'Básico')),
          (select count(distinct technique_id)::int from public.technique_sources where level = 'Básico'), 'a trilha tem exatamente as tecnicas do nivel Basico');
set local role authenticated;

-- Not allowed to configure
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.create_curriculum('00000000-0000-0000-0000-00000000ac01', 'Do Instrutor', null, gen_random_uuid())$$, '42501', null, 'instrutor nao cria curriculo');
select throws_ok($$select public.add_curriculum_item((select id from public.curricula limit 1), '00000000-0000-0000-0000-0000000000a9', true)$$, '42501', null, 'instrutor nao altera a trilha');
select throws_ok($$select public.remove_curriculum_item((select id from public.curriculum_items limit 1))$$, '42501', null, 'instrutor nao remove item');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.create_curriculum('00000000-0000-0000-0000-00000000ac01', 'Invasao', null, gen_random_uuid())$$, '42501', null, 'gestor de outra academia nao cria');
select is((select count(*)::int from public.curricula) + (select count(*)::int from public.curriculum_items), 0, 'gestor de outra academia nao le o curriculo');

-- Reading
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.curricula), 1, 'aluno aprovado le o curriculo');
select is((select count(*)::int from public.curriculum_items), 47, 'e os 47 itens da trilha (46 do nivel Basico + 1 da academia)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select is((select count(*)::int from public.curricula), 0, 'filiacao pendente nao le o curriculo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*)::int from public.curricula), 0, 'externo nao le o curriculo');

-- Student declares progress --------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select public.declare_skill('00000000-0000-0000-0000-00000000ac01', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'studied')), 'studied', 'aluno declara que estudou');
select is((select status || '/' || status_source from public.skill_assessments), 'studied/self', 'registrado como declaracao do aluno');
select is((select public.declare_skill('00000000-0000-0000-0000-00000000ac01', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'practicing')), 'practicing', 'aluno evolui para praticando');
select throws_ok($$select public.declare_skill('00000000-0000-0000-0000-00000000ac01', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated')$$, '22023', null, 'aluno nao declara validated');
select throws_ok($$select public.declare_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b9', 'studied')$$, '22023', null, 'tecnica fora da trilha = VALIDATION_ERROR');
select throws_ok($$insert into public.skill_assessments (academy_id, user_id, technique_id, status, status_source) values ('00000000-0000-0000-0000-00000000ac01','00000000-0000-0000-0000-0000000000d1',(select id from public.techniques limit 1),'studied','self')$$, '42501', null, 'sem INSERT direto em skill_assessments');
select throws_ok($$update public.skill_assessments set status = 'validated'$$, '42501', null, 'aluno nao se valida por UPDATE');
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated', null, gen_random_uuid())$$, '42501', null, 'aluno nao valida o proprio dominio');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select throws_ok($$select public.declare_skill('00000000-0000-0000-0000-00000000ac01', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'studied')$$, '42501', null, 'pendente nao declara progresso');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.declare_skill('00000000-0000-0000-0000-00000000ac01', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'studied')$$, '42501', null, 'externo nao declara progresso');

-- Teachers: permission assess_skills ---------------------------------------------------------------------
reset role;
insert into public.academy_role_permissions (academy_id, role, permission) values ('00000000-0000-0000-0000-00000000ac01', 'instructor', 'assess_skills');
-- i2 is a plain instructor member; to test "instructor WITHOUT the permission" the manager removes it for everyone later
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated', 'bom controle', '12121212-1212-1212-1212-121212121212')), 'validated', 'instrutor com assess_skills valida o dominio');
select is((select status || '/' || status_source from public.skill_assessments where user_id = '00000000-0000-0000-0000-0000000000d1'), 'validated/teacher', 'validado pelo professor');
select is((select assessed_by from public.skill_assessments where user_id = '00000000-0000-0000-0000-0000000000d1'), '00000000-0000-0000-0000-0000000000c1'::uuid, 'avaliador registrado');
select is((select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated', 'bom controle', '12121212-1212-1212-1212-121212121212')), 'validated', 'avaliacao idempotente');
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated', null, '12121212-1212-1212-1212-121212121212')$$, '22023', null, 'mesma chave para outro aluno = VALIDATION_ERROR');
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated', null, gen_random_uuid())$$, '42501', null, 'ninguem valida a si mesmo');
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d3', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'studied', null, gen_random_uuid())$$, '22023', null, 'nao avalia quem tem filiacao pendente');
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b9', 'studied', null, gen_random_uuid())$$, '22023', null, 'tecnica fora da trilha = VALIDATION_ERROR');
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'perfeito', null, gen_random_uuid())$$, '22023', null, 'status invalido = VALIDATION_ERROR');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok($$select public.declare_skill('00000000-0000-0000-0000-00000000ac01', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'studied')$$, '23505', null, 'aluno nao sobrescreve a validacao do professor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'practicing', null, gen_random_uuid())$$, '22023', null, 'tirar a validacao exige justificativa');
select is((select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'practicing', 'precisa treinar mais', gen_random_uuid())), 'practicing', 'com justificativa a validacao pode ser removida');

-- Manager removes the permission: i1 loses it; manager always can
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.set_instructor_permission('00000000-0000-0000-0000-00000000ac01', 'assess_skills', false)$$, 'gestor retira assess_skills dos instrutores');
select is((select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated', null, gen_random_uuid())), 'validated', 'gestor continua avaliando');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated', null, gen_random_uuid())$$, '42501', null, 'instrutor sem assess_skills nao avalia');
select is((select count(*)::int from public.skill_assessments), 0, 'e nao le o progresso dos alunos');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.assess_skill('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'validated', null, gen_random_uuid())$$, '42501', null, 'gestor de outra academia nao avalia');

-- Reads of progress
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select is((select count(*)::int from public.skill_assessments), 1, 'aluno ve so o proprio progresso');
select is((select user_id from public.skill_assessments), '00000000-0000-0000-0000-0000000000d2'::uuid, 'e e o dele');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.set_instructor_permission('00000000-0000-0000-0000-00000000ac01', 'view_progress', true)$$, 'gestor libera view_progress');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*)::int from public.skill_assessments), 2, 'com view_progress o instrutor ve o progresso (mas ainda nao avalia)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.skill_assessments where academy_id = '00000000-0000-0000-0000-00000000ac01'), 2, 'super admin le o progresso de todas as academias');

-- Inactive curriculum leaves the trail
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.update_curriculum((select id from public.curricula where title = 'Faixa Branca'), 'Faixa Branca', 'Básico', false)$$, 'gestor desativa o curriculo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select throws_ok($$select public.declare_skill('00000000-0000-0000-0000-00000000ac01', (select id from public.techniques where name = 'Tesoura' and academy_id is null), 'practicing')$$, '22023', null, 'curriculo inativo nao recebe progresso');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.remove_curriculum_item((select id from public.curriculum_items where technique_id = '00000000-0000-0000-0000-0000000000a9'))$$, 'gestor remove item da trilha');
select is((select count(*)::int from public.curriculum_items where technique_id = '00000000-0000-0000-0000-0000000000a9'), 0, 'item removido');
select ok((select count(*) from public.audit_events where action in ('curriculum.create', 'curriculum.item_add', 'curriculum.items_from_level', 'curriculum.item_required', 'curriculum.item_remove', 'curriculum.update', 'skill.assess')) >= 9, 'operacoes auditadas');
select is((select count(*)::int from public.attendances), 0, 'avaliar habilidade nao cria presenca (dimensoes independentes)');

select * from finish();
rollback;
