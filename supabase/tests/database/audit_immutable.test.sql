-- A trilha de auditoria e append-only. Dados sinteticos.
begin;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}');
insert into public.audit_events (id, actor_user_id, action, entity, metadata)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'teste.evento', 'teste', '{}');

select is((select count(*)::int from public.audit_events where id = '00000000-0000-0000-0000-0000000000e1'), 1, 'o evento e gravado');
select throws_ok($$update public.audit_events set action = 'adulterado' where id = '00000000-0000-0000-0000-0000000000e1'$$, '55000', null, 'UPDATE bloqueado (mesmo para o dono)');
select throws_ok($$delete from public.audit_events where id = '00000000-0000-0000-0000-0000000000e1'$$, '55000', null, 'DELETE bloqueado');
select is((select action from public.audit_events where id = '00000000-0000-0000-0000-0000000000e1'), 'teste.evento', 'o evento continua como foi gravado');

select * from finish();
rollback;
