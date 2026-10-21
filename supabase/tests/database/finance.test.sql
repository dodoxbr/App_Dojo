-- US-017: manual financial control. Synthetic data only.
begin;
select plan(69);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a2', 'gestor2@example.test', '{"display_name":"Gestor Dois","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a3', 'instrutor@example.test', '{"display_name":"Instrutor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a9', 'admin@example.test', '{"display_name":"Super Admin","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'aluno2@example.test', '{"display_name":"Aluno Dois","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b3', 'aluno3@example.test', '{"display_name":"Aluno Tres","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000c1', 'resp@example.test', '{"display_name":"Resp Legal","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000c2', 'fin@example.test', '{"display_name":"Fin Resp","birth_date":"1982-02-02"}'),
 ('00000000-0000-0000-0000-0000000000c9', 'externo@example.test', '{"display_name":"Externo","birth_date":"1981-01-01"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'menor@example.test', jsonb_build_object('display_name', 'Menor Um', 'birth_date', (current_date - interval '9 years')::date::text, 'dependent', true));
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a9');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'fin-um', '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'fin-dois', '00000000-0000-0000-0000-0000000000a2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000a2', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a3', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 'student', 'approved');
insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'legal', 'mae'),
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c2', 'financial', 'tio');
-- Dates in the academy's time zone, computed once as postgres
create temp table ctx as
  select public.academy_today('00000000-0000-0000-0000-00000000ac01') as today,
         date_trunc('month', public.academy_today('00000000-0000-0000-0000-00000000ac01'))::date as month,
         date_trunc('month', public.academy_today('00000000-0000-0000-0000-00000000ac01') - 40)::date as month_old,
         (public.academy_today('00000000-0000-0000-0000-00000000ac01') - 40) as old_due;
grant select on ctx to authenticated;

set local role authenticated;

-- 1. Plans: only the manager of the academy, only for approved students, with explicit values
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 15000, 10, (select today - 30 from ctx), true)$$, 'gestor define o plano do aluno 1');
select lives_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1', 9000, 5, (select today - 30 from ctx), true)$$, 'e do menor');
select lives_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2', 12000, 15, (select today - 30 from ctx), false)$$, 'plano inativo do aluno 2');
select throws_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 0, 10, (select today from ctx), true)$$, '22023', null, 'valor zero rejeitado (a academia define o valor)');
select throws_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 10000, 29, (select today from ctx), true)$$, '22023', null, 'dia de vencimento acima de 28 rejeitado');
select throws_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 10000, 10, (select today + 1000 from ctx), true)$$, '22023', null, 'inicio muito distante rejeitado');
select throws_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a3', 10000, 10, (select today from ctx), true)$$, '22023', null, 'so alunos tem plano (instrutor nao)');
select throws_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c9', 10000, 10, (select today from ctx), true)$$, '22023', null, 'quem nao e da academia nao tem plano');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 1, 10, (select today from ctx), true)$$, '42501', null, 'aluno nao define o proprio plano');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select throws_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 1, 10, (select today from ctx), true)$$, '42501', null, 'instrutor nao define plano');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$select public.set_member_plan('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 1, 10, (select today from ctx), true)$$, '42501', null, 'gestor de outra academia nao define plano');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select throws_ok($$select * from public.list_member_plans('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'super admin nao ve o financeiro');

-- 2. Monthly charges: one per active plan, never duplicated
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select public.generate_monthly_charges('00000000-0000-0000-0000-00000000ac01', (select month from ctx), '11111111-1111-1111-1111-111111111111')), 2, 'gera 2 cobrancas (o plano inativo nao cobra)');
select is((select public.generate_monthly_charges('00000000-0000-0000-0000-00000000ac01', (select month from ctx), '11111111-1111-1111-1111-111111111111')), 2, 'repetir a mesma chave devolve o mesmo resultado');
select is((select public.generate_monthly_charges('00000000-0000-0000-0000-00000000ac01', (select month from ctx), gen_random_uuid())), 0, 'outra chave no mesmo mes nao duplica');
select is((select count(*)::int from public.charges), 2, 'duas cobrancas no total');
select throws_ok($$select public.generate_monthly_charges('00000000-0000-0000-0000-00000000ac01', (select month + 3 from ctx), '11111111-1111-1111-1111-111111111111')$$, '22023', null, 'a mesma chave para outro mes e rejeitada');
select throws_ok($$select public.generate_monthly_charges('00000000-0000-0000-0000-00000000ac01', (select month from ctx) + 1, gen_random_uuid())$$, '22023', null, 'o mes precisa ser o primeiro dia');
select throws_ok($$select public.generate_monthly_charges('00000000-0000-0000-0000-00000000ac01', ((select month from ctx) + interval '12 months')::date, gen_random_uuid())$$, '22023', null, 'mes distante demais rejeitado');
select is((select due_date from public.charges where user_id = '00000000-0000-0000-0000-0000000000b1'), (select month + 9 from ctx), 'vencimento = dia 10 do mes');
select is((select amount_cents from public.charges where user_id = '00000000-0000-0000-0000-0000000000d1'), 9000, 'valor vem do plano do aluno');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$select public.generate_monthly_charges('00000000-0000-0000-0000-00000000ac01', (select month from ctx), gen_random_uuid())$$, '42501', null, 'gestor de outra academia nao gera cobrancas');

-- 3. Manager views
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_academy_charges('00000000-0000-0000-0000-00000000ac01', (select month from ctx))), 2, 'lista do mes com 2 cobrancas');
select is((select financial_name from public.list_academy_charges('00000000-0000-0000-0000-00000000ac01', (select month from ctx)) where user_id = '00000000-0000-0000-0000-0000000000d1'), 'Fin Resp', 'o menor mostra o responsavel financeiro');
select is((select billed_cents from public.finance_summary('00000000-0000-0000-0000-00000000ac01', (select month from ctx))), 24000::bigint, 'previsto = soma das cobrancas');
select is((select received_cents from public.finance_summary('00000000-0000-0000-0000-00000000ac01', (select month from ctx))), 0::bigint, 'nada recebido ainda');
select is((select count(*)::int from public.list_member_plans('00000000-0000-0000-0000-00000000ac01')), 4, 'lista de planos traz os 4 alunos (um sem plano)');
select is((select amount_cents from public.list_member_plans('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b3'), null, 'aluno sem plano aparece sem valor');

-- 4. Marking payments by hand
select throws_ok($$select public.mark_charge_paid((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000b1'), 'bitcoin', (select today from ctx), null)$$, '22023', null, 'forma de pagamento invalida');
select throws_ok($$select public.mark_charge_paid((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000b1'), 'pix', (select today + 1 from ctx), null)$$, '22023', null, 'pagamento em data futura rejeitado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.mark_charge_paid((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000b1'), 'pix', (select today from ctx), null)$$, '42501', null, 'o aluno nao marca o proprio pagamento');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.mark_charge_paid((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000b1'), 'pix', (select today from ctx), 'recebido no balcao (teste)')$$, 'gestor marca como pago');
select lives_ok($$select public.mark_charge_paid((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000b1'), 'pix', (select today from ctx), 'recebido no balcao (teste)')$$, 'repetir a mesma marcacao e inofensivo');
select throws_ok($$select public.mark_charge_paid((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000b1'), 'cash', (select today from ctx), null)$$, '23505', null, 'outra forma sobre uma cobranca paga e conflito (corrija reabrindo)');
select is((select received_cents from public.finance_summary('00000000-0000-0000-0000-00000000ac01', (select month from ctx))), 15000::bigint, 'recebido = valor pago');
select is((select paid_method from public.charges where user_id = '00000000-0000-0000-0000-0000000000b1'), 'pix', 'forma registrada');

-- 5. Cancel, waive, reopen (correction), always with a reason and history
select throws_ok($$select public.cancel_charge((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000d1'), 'x')$$, '22023', null, 'cancelar exige motivo');
select lives_ok($$select public.cancel_charge((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000d1'), 'cobranca duplicada (teste)')$$, 'gestor cancela com motivo');
select throws_ok($$select public.waive_charge((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000d1'), 'bolsa de estudos')$$, '23505', null, 'isentar uma cobranca ja cancelada e conflito');
select lives_ok($$select public.reopen_charge((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000d1'), 'cancelada por engano (teste)')$$, 'reabrir corrige o engano');
select is((select status from public.charges where user_id = '00000000-0000-0000-0000-0000000000d1'), 'open', 'de volta a aberta');
select lives_ok($$select public.waive_charge((select id from public.charges where user_id = '00000000-0000-0000-0000-0000000000d1'), 'bolsa de estudos (teste)')$$, 'isentar uma aberta');
select is((select waived_cents from public.finance_summary('00000000-0000-0000-0000-00000000ac01', (select month from ctx))), 9000::bigint, 'isento nao entra no previsto');

-- 6. One-off charge (idempotent) and overdue
select lives_ok($$select public.create_charge('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'Taxa de exame (teste)', 5000, (select today + 5 from ctx), '22222222-2222-2222-2222-222222222222')$$, 'cobranca avulsa');
select is((select public.create_charge('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'Taxa de exame (teste)', 5000, (select today + 5 from ctx), '22222222-2222-2222-2222-222222222222')),
          (select id from public.charges where description = 'Taxa de exame (teste)'), 'repetir a chave devolve a mesma cobranca');
select is((select count(*)::int from public.charges where description = 'Taxa de exame (teste)'), 1, 'sem duplicar');
select throws_ok($$select public.create_charge('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'Taxa de exame (teste)', 6000, (select today + 5 from ctx), '22222222-2222-2222-2222-222222222222')$$, '22023', null, 'a mesma chave com outro valor e rejeitada');
select throws_ok($$select public.create_charge('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000c9', 'Cobranca de quem nao e membro', 5000, (select today from ctx), gen_random_uuid())$$, '22023', null, 'so se cobra quem e da academia');
select throws_ok($$select public.create_charge('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'Zero', 0, (select today from ctx), gen_random_uuid())$$, '22023', null, 'valor zero rejeitado');

reset role;
insert into public.charges (academy_id, user_id, kind, description, amount_cents, due_date, created_by)
  values ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b3', 'other', 'Mensalidade antiga (teste)', 7000, (select old_due from ctx), '00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select overdue_cents from public.finance_summary('00000000-0000-0000-0000-00000000ac01', (select month_old from ctx))), 7000::bigint, 'atrasado = aberta com vencimento passado');
select is((select overdue from public.list_academy_charges('00000000-0000-0000-0000-00000000ac01', (select month_old from ctx)) where description = 'Mensalidade antiga (teste)'), true, 'a lista marca como atrasada');

-- 7. What each person sees
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.my_charges()), 1, 'o aluno ve as proprias cobrancas');
select is((select count(*)::int from public.charges), 1, 'e so as proprias na tabela');
select throws_ok($$select * from public.my_charges('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'nao ve as cobrancas de outra pessoa');
select throws_ok($$update public.charges set status = 'paid'$$, '42501', null, 'sem UPDATE direto em cobrancas');
select throws_ok($$insert into public.charges (academy_id, user_id, kind, description, amount_cents, due_date, created_by) values ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'other', 'forjada', 1, current_date, '00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'sem INSERT direto');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.my_charges('00000000-0000-0000-0000-0000000000d1')), 1, 'o responsavel legal ve as cobrancas do menor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*)::int from public.my_charges('00000000-0000-0000-0000-0000000000d1')), 1, 'o responsavel financeiro tambem');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c9","role":"authenticated"}', true);
select throws_ok($$select * from public.my_charges('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'terceiros nao veem');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select is((select count(*)::int from public.charges), 0, 'instrutor nao ve cobrancas');
select throws_ok($$select * from public.list_academy_charges('00000000-0000-0000-0000-00000000ac01', (select month from ctx))$$, '42501', null, 'nem pela lista do gestor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.charges), 0, 'gestor de outra academia nao ve');
select throws_ok($$select public.student_finance('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'nem a ficha financeira do aluno');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select public.student_finance('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1') -> 'financial' ->> 'name'), 'Fin Resp', 'ficha financeira mostra o responsavel financeiro');
select ok((select jsonb_array_length(public.student_finance('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000d1') -> 'history') >= 4), 'e o historico das mudancas');
select throws_ok($$select * from public.charge_events$$, '42501', null, 'o historico nao e lido direto');

-- 8. At 18 the guardians stop seeing the charges; the history is immutable
reset role;
update public.profile_private set birth_date = (current_date - interval '19 years')::date where user_id = '00000000-0000-0000-0000-0000000000d1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select * from public.my_charges('00000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'aos 18 anos o responsavel deixa de ver');
reset role;
select throws_ok($$update public.charge_events set event = 'paid'$$, '55000', null, 'o historico e imutavel');
select is((select count(*)::int from public.audit_events where action in ('finance.plan', 'finance.generate', 'finance.paid', 'finance.cancelled', 'finance.waived', 'finance.reopened', 'finance.create_charge')), 10, 'tudo foi auditado');

select * from finish();
rollback;
