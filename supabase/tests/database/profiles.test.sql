-- US-002: profile creation and isolation. Synthetic data only.
begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'a@example.test', '{"display_name":"  Aluno A Teste  "}'),
 ('00000000-0000-0000-0000-0000000000b1', 'b@example.test', '{}'),
 ('00000000-0000-0000-0000-0000000000c1', 'c@example.test', json_build_object('display_name', repeat('x', 300))::jsonb);

select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 1, 'cadastro cria exatamente um perfil');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'Aluno A Teste', 'nome informado e aparado');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'Novo usuário', 'sem nome usa padrao neutro');
select is((select length(display_name) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 120, 'nome longo truncado em 120');

set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon nao le perfis');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles), 1, 'A le somente o proprio perfil');
select lives_ok($$update public.profiles set display_name = 'Aluno A Novo' where id = '00000000-0000-0000-0000-0000000000a1'$$, 'A edita o proprio nome');
select throws_ok($$update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-0000000000a1'$$, '23514', null, 'nome invalido rejeitado');
select is_empty($$update public.profiles set display_name = 'Hack' where id = '00000000-0000-0000-0000-0000000000b1' returning id$$, 'A nao edita perfil de B');
select throws_ok($$update public.profiles set id = '00000000-0000-0000-0000-0000000000d1' where id = '00000000-0000-0000-0000-0000000000a1'$$, '42501', null, 'A nao altera o id');
select throws_ok($$update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-0000000000a1'$$, '42501', null, 'A nao altera created_at');
select throws_ok($$insert into public.profiles (id, display_name) values ('00000000-0000-0000-0000-0000000000d1', 'Fake')$$, '42501', null, 'sem INSERT direto em profiles');

select * from finish();
rollback;
