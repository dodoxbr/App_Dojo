-- Logo da academia: só o gestor (ou super admin) grava; a leitura é pública por função; a tabela não é lida direto. Dados sintéticos.
begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'gestor@example.test', '{"display_name":"Gestor Um","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000a9', 'admin@example.test', '{"display_name":"Super Admin","birth_date":"1985-05-05"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'aluno1@example.test', '{"display_name":"Aluno Um","birth_date":"1990-01-01"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'gestor2@example.test', '{"display_name":"Gestor Dois","birth_date":"1985-05-05"}');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a9');
insert into public.academies (id, name, slug, owner_user_id) values
 ('00000000-0000-0000-0000-00000000ac01', 'Academia Um', 'lg-um', '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-00000000ac02', 'Academia Dois', 'lg-dois', '00000000-0000-0000-0000-0000000000b2');
insert into public.memberships (academy_id, user_id, role, status) values
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000a1', 'manager', 'approved'),
 ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000b1', 'student', 'approved'),
 ('00000000-0000-0000-0000-00000000ac02', '00000000-0000-0000-0000-0000000000b2', 'manager', 'approved');
create temp table pics as select decode('52494646' || '00000000' || '57454250' || repeat('00', 120), 'hex') as webp, decode('ffd8ffe000104a46494600010100000100010000' || repeat('00', 120), 'hex') as jpeg;
grant select on pics to authenticated, anon;

set local role authenticated;

-- 1. O aluno e o gestor de outra academia não gravam
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.set_academy_logo('00000000-0000-0000-0000-00000000ac01', (select webp from pics))$$, '42501', null, 'aluno nao grava a logo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select public.set_academy_logo('00000000-0000-0000-0000-00000000ac01', (select webp from pics))$$, '42501', null, 'gestor de outra academia nao grava');

-- 2. O gestor grava (só WebP) e a gravação fica auditada
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.set_academy_logo('00000000-0000-0000-0000-00000000ac01', (select jpeg from pics))$$, '22023', null, 'so aceita WebP (o servidor sempre regrava)');
select throws_ok($$select public.set_academy_logo('00000000-0000-0000-0000-00000000ac01', '\x52494646'::bytea)$$, '22023', null, 'imagem pequena demais e rejeitada');
select lives_ok($$select public.set_academy_logo('00000000-0000-0000-0000-00000000ac01', (select webp from pics))$$, 'gestor grava a logo');
select is((select count(*)::int from public.audit_events where academy_id = '00000000-0000-0000-0000-00000000ac01' and action = 'academy.logo'), 1, 'gravacao auditada');

-- 3. Leitura pública por função; a tabela em si não é legível
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select ok((select public.academy_logo('00000000-0000-0000-0000-00000000ac01')) is not null, 'qualquer pessoa logada le a logo (identidade publica)');
select ok((select public.academy_logo_version('00000000-0000-0000-0000-00000000ac01')) is not null, 'e a versao');
select throws_ok($$select * from public.academy_logos$$, '42501', null, 'a tabela nao e lida direto');
select is((select public.academy_logo('00000000-0000-0000-0000-00000000ac02')), null, 'academia sem logo devolve nulo');

-- 4. Remover (só gestor)
select throws_ok($$select public.remove_academy_logo('00000000-0000-0000-0000-00000000ac01')$$, '42501', null, 'gestor de outra academia nao remove');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select lives_ok($$select public.remove_academy_logo('00000000-0000-0000-0000-00000000ac01')$$, 'super admin remove');

select * from finish();
rollback;
