-- Termo de uso de imagem assinado pelo responsável (migration 039). Dados sintéticos.
begin;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000e1', 'resp1@example.test', '{"display_name":"Resp Um","birth_date":"1984-04-04"}'),
 ('00000000-0000-0000-0000-0000000000e9', 'estranho@example.test', '{"display_name":"Estranho","birth_date":"1980-01-01"}'),
 ('00000000-0000-0000-0000-0000000000d4', 'menor4@example.test', jsonb_build_object('display_name', 'Menor Quatro', 'birth_date', (current_date - interval '12 years')::date::text, 'dependent', true)),
 ('00000000-0000-0000-0000-0000000000d5', 'menor5@example.test', jsonb_build_object('display_name', 'Menor Cinco', 'birth_date', (current_date - interval '8 years')::date::text, 'dependent', true));
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'pt-um', '00000000-0000-0000-0000-0000000000a1');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved');
insert into public.guardianships (minor_user_id, guardian_user_id, kind, relationship) values
 ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae'),
 ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000e1', 'legal', 'mae');
insert into public.profile_contacts (user_id, full_name, phone, postal_code, street, number, neighborhood, city, state, emergency_name, emergency_phone, emergency_relationship, updated_by) values
 ('00000000-0000-0000-0000-0000000000d4', 'Menor Quatro', '11999990000', '01001000', 'Quadra 1', '1', 'Centro', 'Sao Paulo', 'SP', 'Contato', '11977776666', 'mae', '00000000-0000-0000-0000-0000000000e1'),
 ('00000000-0000-0000-0000-0000000000d5', 'Menor Cinco', '11999990000', '01001000', 'Quadra 1', '1', 'Centro', 'Sao Paulo', 'SP', 'Contato', '11977776666', 'mae', '00000000-0000-0000-0000-0000000000e1');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);

-- 1. Autorizar fotos exige a assinatura (nome completo)
select throws_ok($$select public.request_dependent_membership('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-00000000ac01', true, false, null)$$, '22023', null, 'foto sem assinatura e recusada');
select throws_ok($$select public.request_dependent_membership('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-00000000ac01', true, false, 'Maria')$$, '22023', null, 'so o primeiro nome nao vale como assinatura');
select lives_ok($$select public.request_dependent_membership('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-00000000ac01', true, false, 'Maria da Silva Teste')$$, 'com nome completo, o pedido e a assinatura passam');
select is((select signed_name from public.photo_term_status('00000000-0000-0000-0000-0000000000d4')), 'Maria da Silva Teste', 'o responsavel ve o termo assinado');

-- 2. Sem foto no pedido: da para assinar depois; nao-responsavel nao assina
select lives_ok($$select public.request_dependent_membership('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-00000000ac01', false)$$, 'pedido sem autorizar fotos continua valendo');
select is((select count(*)::int from public.photo_term_status('00000000-0000-0000-0000-0000000000d5')), 0, 'e nao ha termo de imagem assinado');
select throws_ok($$select public.sign_photo_term('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-00000000ac01', 'Maria')$$, '22023', null, 'assinar depois tambem exige o nome completo');
select lives_ok($$select public.sign_photo_term('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-00000000ac01', 'Maria da Silva Teste')$$, 'o responsavel assina depois');
select is((select count(*)::int from public.photo_term_status('00000000-0000-0000-0000-0000000000d5')), 1, 'agora o termo aparece');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e9","role":"authenticated"}', true);
select throws_ok($$select public.sign_photo_term('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-00000000ac01', 'Estranho da Silva')$$, '42501', null, 'quem nao e responsavel nao assina');

-- 3. O gestor ve quem assinou
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_academy_guardian_consents('00000000-0000-0000-0000-00000000ac01') where photo_signed_name = 'Maria da Silva Teste'), 2, 'o gestor ve o nome digitado e a data nas duas autorizacoes');

select * from finish();
rollback;
