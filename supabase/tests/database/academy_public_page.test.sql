-- Página pública da academia: opt-in do gestor, leitura pública só do que foi publicado, validações. Dados sintéticos.
begin;
select plan(21);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'gestor2@example.test', '{"display_name":"Gestor Dois","birth_date":"1985-05-05"}');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'pg-um', '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'pg-dois', '00000000-0000-0000-0000-0000000000b2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000b2', 'manager', 'approved');

set local role authenticated;

-- 1. Só o gestor da própria academia edita e lê o perfil para editar
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.save_academy_profile('00000000-0000-0000-0000-00000000ac01', true, 'x', null, '{}', null, null, null, null, null, null, null, null, null, null, null)$$, '42501', null, 'aluno nao edita');
select throws_ok($$select public.get_academy_profile('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'aluno nao le o perfil para editar');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select public.save_academy_profile('00000000-0000-0000-0000-00000000ac01', true, 'x', null, '{}', null, null, null, null, null, null, null, null, null, null, null)$$, '42501', null, 'gestor de outra academia nao edita');

-- 2. O gestor salva (oculto por padrão) e a leitura pública não devolve nada
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.save_academy_profile('00000000-0000-0000-0000-00000000ac01', false, 'Jiu-Jitsu e Taekwondo', 'Escola de artes marciais.', array['Jiu-Jitsu','Kids',' ','Jiu-Jitsu'], '6133334444', '61998731958', 'Quadra 1, Lote 2', 'Águas Claras', 'DF', 'https://maps.example.test/x', 'time_ficticio', null, null, null, 'https://exemplo.test')$$, 'gestor salva o perfil (oculto)');
select is((select public.public_academy_page('pg-um')), null, 'nao publicado: a pagina publica nao existe');
select is((select jsonb_array_length(public.get_academy_profile('00000000-0000-0000-0000-00000000ac01') -> 'modalities')), 2, 'modalidades limpas (sem vazias nem repetidas)');

-- 3. Publica: qualquer um (até sem login) lê só os campos do perfil
select lives_ok($$select public.save_academy_profile('00000000-0000-0000-0000-00000000ac01', true, 'Jiu-Jitsu e Taekwondo', 'Escola de artes marciais.', array['Jiu-Jitsu','Kids'], '6133334444', '61998731958', 'Quadra 1, Lote 2', 'Águas Claras', 'DF', 'https://maps.example.test/x', 'time_ficticio', null, null, null, 'https://exemplo.test')$$, 'gestor publica');
reset role;
set local role anon;
select is((select public.public_academy_page('PG-UM') ->> 'name'), 'Academia Um', 'visitante sem login le a pagina publicada (slug sem diferenciar maiusculas)');
select is((select public.public_academy_page('pg-um') ->> 'whatsapp'), '61998731958', 'com os dados de contato');
select is((select public.public_academy_page('pg-um') ? 'owner_user_id'), false, 'e nenhum dado de pessoa ou interno');
select is((select public.public_academy_page('pg-dois')), null, 'academia sem perfil publicado: nada');
select throws_ok($$select * from public.academy_profiles$$, '42501', null, 'a tabela nao e legivel direto');

-- 4. Validações do banco
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.save_academy_profile('00000000-0000-0000-0000-00000000ac01', true, null, null, '{}', '123', null, null, null, null, null, null, null, null, null, null)$$, '22023', null, 'telefone invalido');
select throws_ok($$select public.save_academy_profile('00000000-0000-0000-0000-00000000ac01', true, null, null, '{}', null, null, null, null, null, 'javascript:alert(1)', null, null, null, null, null)$$, '22023', null, 'so link https');
select throws_ok($$select public.save_academy_profile('00000000-0000-0000-0000-00000000ac01', true, null, null, '{}', null, null, null, null, null, null, 'nome com espaco', null, null, null, null)$$, '22023', null, 'usuario de rede social invalido');

-- 5. Grade de horarios (migration 037)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.save_academy_schedule('00000000-0000-0000-0000-00000000ac01', '[]')$$, '42501', null, 'aluno nao edita a grade');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.save_academy_schedule('00000000-0000-0000-0000-00000000ac01', '[{"title":"Adulto - Manha","lines":[{"days":[1,3],"times":["10:00"]},{"days":[2,4],"times":["07:00","09:00","12:00"],"label":"Fundamentos"}]},{"title":"Infantil","note":"Kids","lines":[{"days":[1,3],"times":["18:30"]}]}]')$$, 'gestor salva a grade');
select is((select jsonb_array_length(public.get_academy_profile('00000000-0000-0000-0000-00000000ac01') -> 'schedule')), 2, 'grade volta na edicao');
select throws_ok($$select public.save_academy_schedule('00000000-0000-0000-0000-00000000ac01', '[{"title":"X","lines":[{"days":[8],"times":["10:00"]}]}]')$$, '22023', null, 'dia da semana invalido');
select throws_ok($$select public.save_academy_schedule('00000000-0000-0000-0000-00000000ac01', '[{"title":"X","lines":[{"days":[1],"times":["25:00"]}]}]')$$, '22023', null, 'hora invalida');
reset role;
set local role anon;
select is((select jsonb_array_length(public.public_academy_page('pg-um') -> 'schedule')), 2, 'a pagina publica traz a grade');

select * from finish();
rollback;
