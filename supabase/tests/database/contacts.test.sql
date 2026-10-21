-- US-016: terms accepted at sign-up and the registration form (ficha). Synthetic data only.
begin;
select plan(35);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"birth_date":"1985-05-05","terms_version":"rascunho-2026-10"}'),
 ('00000000-0000-0000-0000-0000000000a2', 'gestor2@example.test', '{"birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a3', 'instrutor@example.test', '{"birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'pessoa1@example.test', '{"birth_date":"1990-01-01","terms_version":"rascunho-2026-10"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'pessoa2@example.test', '{"birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b3', 'pessoa3@example.test', '{"birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b4', 'pessoa4@example.test', '{"birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000d1', 'dependente@example.test', '{"birth_date":"2018-01-01","terms_version":"rascunho-2026-10","dependent":true}');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'ficha-um', '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'ficha-dois', '00000000-0000-0000-0000-0000000000a2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000a2', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a3', 'instructor', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b4', 'student', 'approved');

-- Terms recorded by the sign-up trigger
select is((select count(*)::int from public.terms_acceptances where user_id = '00000000-0000-0000-0000-0000000000b1'), 2, 'cadastro com termos: termos de uso e politica registrados');
select is((select count(*)::int from public.terms_acceptances where user_id = '00000000-0000-0000-0000-0000000000b2'), 0, 'cadastro sem termos: nada registrado');
select is((select count(*)::int from public.terms_acceptances where user_id = '00000000-0000-0000-0000-0000000000d1'), 0, 'dependente nunca aceita sozinho (o responsavel aceita por si)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select public.my_terms_version()), null, 'quem nao aceitou nao tem versao');
select lives_ok($$select public.accept_terms('rascunho-2026-10')$$, 'conta antiga aceita os termos');
select lives_ok($$select public.accept_terms('rascunho-2026-10')$$, 'aceitar de novo e inofensivo');
select is((select count(*)::int from public.terms_acceptances), 2, 'duas linhas (termos e politica), sem duplicar');
select is((select public.my_terms_version()), 'rascunho-2026-10', 'a versao aceita fica registrada');
select throws_ok($$select public.accept_terms('x')$$, '22023', null, 'versao invalida rejeitada');
select is((select count(*)::int from public.terms_acceptances where user_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'ninguem le o aceite de outra pessoa');
select throws_ok($$insert into public.terms_acceptances (user_id, document, version) values ('00000000-0000-0000-0000-0000000000b2', 'terms_of_use', 'forjado')$$, '42501', null, 'sem INSERT direto em terms_acceptances');

-- The ficha: own data, normalized, validated
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.save_contact('00000000-0000-0000-0000-0000000000b1', 'Pessoa Um da Silva', '(11) 99999-0000', '01001-000', 'Rua Ficticia', '10', 'ap 2', 'Centro', 'Sao Paulo', 'sp')$$, 'a pessoa preenche a propria ficha');
select is((select phone from public.get_contact('00000000-0000-0000-0000-0000000000b1')), '11999990000', 'telefone guardado so com digitos');
select is((select postal_code || state from public.get_contact('00000000-0000-0000-0000-0000000000b1')), '01001000SP', 'CEP em digitos e UF em maiuscula');
select throws_ok($$select public.save_contact('00000000-0000-0000-0000-0000000000b1', 'P', '11999990000', '01001000', 'Rua', '1', null, 'Centro', 'Sao Paulo', 'SP')$$, '22023', null, 'nome curto rejeitado');
select throws_ok($$select public.save_contact('00000000-0000-0000-0000-0000000000b1', 'Pessoa Um', '1234', '01001000', 'Rua', '1', null, 'Centro', 'Sao Paulo', 'SP')$$, '22023', null, 'telefone curto rejeitado');
select throws_ok($$select public.save_contact('00000000-0000-0000-0000-0000000000b1', 'Pessoa Um', '11999990000', '123', 'Rua', '1', null, 'Centro', 'Sao Paulo', 'SP')$$, '22023', null, 'CEP invalido rejeitado');
select throws_ok($$select public.save_contact('00000000-0000-0000-0000-0000000000b1', 'Pessoa Um', '11999990000', '01001000', 'Rua', '1', null, 'Centro', 'Sao Paulo', 'SPP')$$, '22023', null, 'UF invalida rejeitada');
select throws_ok($$select public.save_contact('00000000-0000-0000-0000-0000000000b1', 'Pessoa Um', '11999990000', '01001000', '', '1', null, 'Centro', 'Sao Paulo', 'SP')$$, '22023', null, 'rua vazia rejeitada');
select is((select count(*)::int from public.profile_contacts), 1, 'a pessoa le a propria ficha direto');
select throws_ok($$update public.profile_contacts set phone = '11000000000'$$, '42501', null, 'sem UPDATE direto na ficha');

-- Nobody else reads it: other people, other academies' managers, instructors
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select * from public.get_contact('00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'outra pessoa nao le a ficha');
select throws_ok($$select public.save_contact('00000000-0000-0000-0000-0000000000b1', 'Invasor', '11999990000', '01001000', 'Rua', '1', null, 'Centro', 'Sao Paulo', 'SP')$$, '42501', null, 'nem altera');
select is((select count(*)::int from public.profile_contacts), 0, 'e a tabela nao mostra a ficha alheia');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select throws_ok($$select * from public.get_member_contact('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'instrutor nao le a ficha');
select throws_ok($$select * from public.contact_status('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'nem o status das fichas');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$select * from public.get_member_contact('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'gestor de outra academia nao le a ficha');

-- The manager reads the ficha of a member of the academy, and the read is audited
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select full_name from public.get_member_contact('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1')), 'Pessoa Um da Silva', 'gestor le a ficha de um membro');
select throws_ok($$select * from public.get_member_contact('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b2')$$, '42501', null, 'mas nao de quem nao tem vinculo com a academia');
select is((select has_contact from public.contact_status('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b1'), true, 'status: ficha preenchida');
select is((select has_contact from public.contact_status('00000000-0000-0000-0000-00000000ac01') where user_id = '00000000-0000-0000-0000-0000000000b4'), false, 'status: ficha pendente');

-- Gates: nobody joins without the ficha
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select throws_ok($$select public.request_membership('00000000-0000-0000-0000-00000000ac01')$$, '22023', null, 'sem ficha nao se pede entrada');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.add_member('00000000-0000-0000-0000-00000000ac01', 'pessoa3@example.test', 'student')$$, '22023', null, 'gestor tambem nao cadastra quem esta sem ficha');

reset role;
select is((select count(*)::int from public.audit_events where action = 'contact.view' and entity_id = '00000000-0000-0000-0000-0000000000b1'), 1, 'a leitura do gestor foi auditada');
select is((select count(*)::int from public.audit_events where action in ('contact.save', 'contact.view') and metadata::text like '%99999%'), 0, 'a auditoria nao guarda telefone nem endereco');

select * from finish();
rollback;
