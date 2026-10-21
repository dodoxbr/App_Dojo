-- US-013 (part 2): guardians and minors. Synthetic data only.
begin;
select plan(66);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000b1', 'gestor@example.test', '{"birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'gestor2@example.test', '{"birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'responsavel@example.test', '{"birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000e2', 'financeiro@example.test', '{"birth_date":"1982-02-02"}'),
 ('00000000-0000-0000-0000-0000000000e3', 'outra@example.test', '{"birth_date":"1983-03-03"}'),
 ('00000000-0000-0000-0000-0000000000e4', 'externa@example.test', '{"birth_date":"1981-01-01"}'),
 ('00000000-0000-0000-0000-0000000000f1', 'adolescente@example.test', jsonb_build_object('birth_date', (current_date - interval '15 years')::date::text));
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'resp-um', '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'resp-dois', '00000000-0000-0000-0000-0000000000b2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000b2', 'manager', 'approved');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);

-- 1. The guardian creates the dependent (idempotent; only minors; with validation)
select lives_ok($$select public.create_dependent('Crianca Teste', (current_date - interval '9 years')::date, 'mae', '11111111-1111-1111-1111-111111111111')$$, 'responsavel cria o dependente');
select lives_ok($$select public.create_dependent('Crianca Teste', (current_date - interval '9 years')::date, 'mae', '11111111-1111-1111-1111-111111111111')$$, 'repetir a mesma chave e a mesma requisicao nao duplica');
select throws_ok($$select public.create_dependent('Outro Nome', (current_date - interval '9 years')::date, 'mae', '11111111-1111-1111-1111-111111111111')$$, '22023', null, 'a mesma chave com outro pedido e rejeitada');
select throws_ok($$select public.create_dependent('Adulto Disfarcado', (current_date - interval '18 years')::date, 'mae', gen_random_uuid())$$, '22023', null, 'quem ja fez 18 anos nao e dependente');
select throws_ok($$select public.create_dependent('Do Futuro', current_date + 5, 'mae', gen_random_uuid())$$, '22023', null, 'data futura rejeitada');
select throws_ok($$select public.create_dependent('X', (current_date - interval '9 years')::date, 'mae', gen_random_uuid())$$, '22023', null, 'nome muito curto');
select throws_ok($$select public.create_dependent('Sem Parentesco', (current_date - interval '9 years')::date, ' ', gen_random_uuid())$$, '22023', null, 'parentesco obrigatorio');
select throws_ok($$select public.create_dependent('Sem Chave', (current_date - interval '9 years')::date, 'mae', null)$$, '22023', null, 'chave de idempotencia obrigatoria');
select is((select count(*)::int from public.list_my_dependents()), 1, 'uma unica linha de dependente apos repetir');
select is((select kind from public.list_my_dependents()), 'legal', 'quem cria e o responsavel legal');
select is((select minor_is_adult from public.list_my_dependents()), false, 'o dependente e menor');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.create_dependent('Irmao', (current_date - interval '5 years')::date, 'irma', gen_random_uuid())$$, '22023', null, 'um menor nao cria dependentes');

-- limit of dependents per guardian
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}', true);
select lives_ok($q$do $b$ begin for i in 1..7 loop perform public.create_dependent('Filho ' || i, (current_date - interval '8 years')::date, 'pai', gen_random_uuid()); end loop; end $b$$q$, 'ate 7 dependentes');
select throws_ok($$select public.create_dependent('Filho 8', (current_date - interval '8 years')::date, 'pai', gen_random_uuid())$$, '22023', null, 'o 8o dependente e recusado (premissa antiabuso)');

-- the dependent account has no way to sign in

reset role;
create temp table dep as select id from public.profiles where display_name = 'Crianca Teste';
grant select on dep to authenticated;
select is((select email from auth.users where id = (select id from dep)), null, 'dependente sem e-mail');
select is((select encrypted_password from auth.users where id = (select id from dep)), null, 'dependente sem senha');
select is((select count(*)::int from auth.identities where user_id = (select id from dep)), 0, 'dependente sem identidade de login');
select is((select count(*)::int from public.profile_private where user_id = (select id from dep)), 1, 'data de nascimento guardada (privada)');

-- 2. Joining an academy: consent by the legal guardian, verification by the manager
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}', true);
select throws_ok($$select public.request_dependent_membership((select id from dep), '00000000-0000-0000-0000-00000000ac01', false)$$, '42501', null, 'quem nao e responsavel nao pede vaga');
select is((select count(*)::int from public.guardianships), 0, 'e nao enxerga vinculos alheios');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select lives_ok($$select public.request_dependent_membership((select id from dep), '00000000-0000-0000-0000-00000000ac01', false)$$, 'responsavel pede a vaga e consente');
select lives_ok($$select public.request_dependent_membership((select id from dep), '00000000-0000-0000-0000-00000000ac01', false)$$, 'repetir o pedido nao duplica');
select is((select consent_photos from public.guardian_consents), false, 'foto desligada por padrao');
select is((select status from public.guardian_consents), 'pending', 'consentimento aguarda a conferencia do gestor');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.memberships where user_id = (select id from dep)), 1, 'um unico pedido de filiacao');
select throws_ok($$select public.decide_membership((select id from public.memberships where user_id = (select id from dep)), 'approved', null, gen_random_uuid())$$, '22023', null, 'sem conferencia do responsavel o menor nao e aprovado');
select throws_ok($$select public.verify_guardian_consent((select id from public.guardian_consents), false, null)$$, '22023', null, 'o documento precisa ter sido conferido');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select public.verify_guardian_consent((select id from public.guardian_consents), true, null)$$, '42501', null, 'gestor de outra academia nao confere');
select is((select count(*)::int from public.guardian_consents), 0, 'nem enxerga o consentimento');
select throws_ok($$select * from public.list_academy_guardian_consents('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'nem lista os responsaveis de outra academia');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.verify_guardian_consent((select id from public.guardian_consents), true, null)$$, '42501', null, 'o proprio responsavel nao se verifica');
select throws_ok($$select * from public.list_academy_guardian_consents('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'responsavel nao lista a lista do gestor');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_academy_guardian_consents('00000000-0000-0000-0000-00000000ac01')), 1, 'gestor lista o consentimento pendente');
select lives_ok($$select public.verify_guardian_consent((select id from public.guardian_consents), true, 'RG conferido pessoalmente (teste)')$$, 'gestor confere o responsavel pessoalmente');
select is((select status from public.guardian_consents), 'verified', 'consentimento verificado');
select is((select verified_by from public.guardian_consents), '00000000-0000-0000-0000-0000000000b1'::uuid, 'quem conferiu fica registrado');
select is((select public.decide_membership((select id from public.memberships where user_id = (select id from dep)), 'approved', null, gen_random_uuid())), 'approved', 'agora o menor e aprovado');
select is((select is_minor and guardian_ready from public.member_age_flags('00000000-0000-0000-0000-00000000ac01') where user_id = (select id from dep)), true, 'a lista do gestor marca "menor" e responsavel em dia');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}', true);
select throws_ok($$select * from public.member_age_flags('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'quem nao e da equipe nao ve a marca de menor');

-- 3. What the legal guardian follows: attendance (validated only), rank, agenda — never the diary
reset role;
insert into public.classes (id, academy_id, title, instructor_user_id) values
 ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000ac01', 'Turma Infantil Teste', '00000000-0000-0000-0000-0000000000b1');
insert into public.sessions (id, academy_id, class_id, starts_at, ends_at) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', now() - interval '3 days', now() - interval '3 days' + interval '1 hour'),
 ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', now() - interval '2 days', now() - interval '2 days' + interval '1 hour'),
 ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c1', now() + interval '2 days', now() + interval '2 days' + interval '1 hour');
insert into public.attendances (academy_id, session_id, user_id, status, source, validated_by, validated_at)
  select '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', id, 'validated', 'teacher', '00000000-0000-0000-0000-0000000000b1', now()
  from public.profiles where display_name = 'Crianca Teste';
insert into public.attendances (academy_id, session_id, user_id, status, source)
  select '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d2', id, 'pending', 'manual'
  from public.profiles where display_name = 'Crianca Teste';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select public.guardian_overview((select id from dep)) -> 'academies' -> 0 ->> 'validated_attendances_30_days')::int, 1, 'so a presenca validada conta (a pendente nao)');
select is((select public.guardian_overview((select id from dep)) -> 'academies' -> 0 ->> 'membership_status'), 'approved', 'o responsavel ve a situacao da vaga');
select is((select jsonb_array_length(public.guardian_overview((select id from dep)) -> 'academies' -> 0 -> 'next_sessions')), 1, 'e a agenda das proximas aulas');
select is((select count(*)::int from public.training_logs), 0, 'o diario do menor nao e acessivel ao responsavel');
select throws_ok($$select public.guardian_overview('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'responsavel nao acompanha quem nao e seu dependente');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}', true);
select throws_ok($$select public.guardian_overview((select id from dep))$$, '42501', null, 'terceiros nao acompanham o menor');

-- 4. Financial responsible: another adult by invite code; no access to attendance or rank
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}', true);
select throws_ok($$select * from public.create_financial_invite((select id from dep))$$, '42501', null, 'terceiro nao convida financeiro');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
create temp table invite_code as select code from public.create_financial_invite((select id from dep));
select throws_ok($$select * from public.guardian_invites$$, '42501', null, 'o convite (hash) nao e legivel por clientes');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select throws_ok($$select public.accept_financial_invite('CODIGOERRADO', 'tio')$$, '22023', null, 'codigo errado');
select lives_ok($$select public.accept_financial_invite((select code from invite_code), 'tio')$$, 'o convidado vira responsavel financeiro');
select throws_ok($$select public.accept_financial_invite((select code from invite_code), 'tio')$$, '22023', null, 'o codigo vale uma vez so');
select is((select kind from public.list_my_dependents()), 'financial', 'o financeiro ve o dependente como financeiro');
select throws_ok($$select public.guardian_overview((select id from dep))$$, '42501', null, 'financeiro nao acompanha presenca nem graduacao');
select throws_ok($$select public.request_dependent_membership((select id from dep), '00000000-0000-0000-0000-00000000ac02', false)$$, '42501', null, 'financeiro nao pede vaga');
select throws_ok($$select public.revoke_guardian_consent((select id from public.guardian_consents))$$, '42501', null, 'nem revoga o consentimento');

-- 5. Revoking: suspends the minor right away; a new consent needs a new verification
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select lives_ok($$select public.revoke_guardian_consent((select id from public.guardian_consents))$$, 'o responsavel revoga o consentimento');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select status::text from public.memberships where user_id = (select id from dep)), 'suspended', 'o menor e suspenso na hora');
select throws_ok($$select public.verify_guardian_consent((select id from public.guardian_consents), true, null)$$, '23505', null, 'consentimento revogado nao e verificado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select lives_ok($$select public.request_dependent_membership((select id from dep), '00000000-0000-0000-0000-00000000ac01', true)$$, 'novo consentimento (agora com foto)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.decide_membership((select id from public.memberships where user_id = (select id from dep)), 'approved', null, gen_random_uuid())$$, '22023', null, 'depois da revogacao e preciso conferir de novo');

-- 6. Direct writes are closed and anonymous callers have no access
select throws_ok($$insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'legal', 'pai')$$, '42501', null, 'sem INSERT direto em guardianships');
select throws_ok($$update public.guardian_consents set status = 'verified'$$, '42501', null, 'sem UPDATE direto em guardian_consents');
select throws_ok($$select public.can_join_academy('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'can_join_academy nao e chamavel por clientes');
select throws_ok($$select public.is_legal_guardian_of('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'is_legal_guardian_of nao e chamavel por clientes');
reset role;
set local role anon;
select throws_ok($$select public.create_dependent('Anonimo', (current_date - interval '9 years')::date, 'mae', gen_random_uuid())$$, '42501', null, 'anonimo nao cria dependente');
reset role;

-- 7. At 18 the guardian's access ends
update public.profile_private set birth_date = (current_date - interval '19 years')::date
  where user_id = (select id from dep);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$select public.guardian_overview((select id from dep))$$, '42501', null, 'ao completar 18 anos o acesso do responsavel termina');
select throws_ok($$select public.request_dependent_membership((select id from dep), '00000000-0000-0000-0000-00000000ac02', false)$$, '42501', null, 'e ele nao pede mais vaga em nome do jovem');

select * from finish();
rollback;
