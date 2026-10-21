-- Verificador de pré-lançamento. SOMENTE LEITURA (nenhum comando altera dados).
-- Como usar: cole no "SQL Editor" do painel do Supabase do ambiente que você quer conferir (teste ou produção) e execute.
-- Local: docker exec -i supabase_db_dojo-platform-local psql -U postgres -d postgres < scripts/prelaunch-check.sql
-- Cada bloco devolve uma coluna "situacao": OK ou ATENCAO. Antes de abrir para pessoas reais, tudo deve estar OK.

-- 1) Toda tabela do schema public precisa ter RLS ligada (negar por padrão).
select '1. RLS ligada em todas as tabelas' as verificacao,
       case when count(*) = 0 then 'OK' else 'ATENCAO: sem RLS -> ' || string_agg(c.relname, ', ') end as situacao
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2) O visitante anônimo não deve ter acesso direto a nenhuma tabela.
select '2. Anônimo sem acesso direto a tabelas' as verificacao,
       case when count(*) = 0 then 'OK' else 'ATENCAO: ' || string_agg(distinct table_name, ', ') end as situacao
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';

-- 3) Funções que o anônimo consegue executar (esperado: apenas public_academy_legal, usada na página pública de termos).
select '3. Funções abertas ao anônimo (esperado: so public_academy_legal)' as verificacao,
       case when coalesce(string_agg(routine_name, ', ') filter (where routine_name <> 'public_academy_legal'), '') = '' then 'OK'
            else 'ATENCAO: ' || string_agg(routine_name, ', ') filter (where routine_name <> 'public_academy_legal') end as situacao
from information_schema.routine_privileges
where routine_schema = 'public' and grantee = 'anon';

-- 4) Acesso do super admin aos diários dos alunos: só pode estar LIGADO na fase de teste. Em produção deve estar DESLIGADO.
select '4. Super admin NAO le diarios (admin_diary_access = false)' as verificacao,
       case when admin_diary_access then 'ATENCAO: ligado (permitido so em teste). Desligue: update public.platform_settings set admin_diary_access = false;'
            else 'OK' end as situacao
from public.platform_settings;

-- 5) Quem são os super admins (confira se são só as pessoas esperadas).
select '5. Super admins cadastrados' as verificacao,
       coalesce(string_agg(u.email, ', '), 'nenhum') as situacao
from public.platform_admins a join auth.users u on u.id = a.user_id;

-- 6) Tarefas agendadas (geração automática de mensalidades e limpeza das fotos do feed).
select '6. Tarefas agendadas (pg_cron) ativas' as verificacao,
       case when count(*) filter (where jobname in ('auto-charges', 'purge-feed') and active) = 2 then 'OK'
            else 'ATENCAO: faltam tarefas. Ativas: ' || coalesce(string_agg(jobname, ', ') filter (where active), 'nenhuma') end as situacao
from cron.job;

-- 7) Confirmação de e-mail e dados de teste: em produção não deve haver contas de exemplo.
select '7. Sem contas de exemplo (@example.test)' as verificacao,
       case when count(*) = 0 then 'OK' else 'ATENCAO: ' || count(*) || ' conta(s) de exemplo' end as situacao
from auth.users where email like '%@example.test';

-- 8) Quantidade de dados reais (informativo): ajuda a perceber se o ambiente de teste já tem gente de verdade.
select '8. Contagem (informativo)' as verificacao,
       (select count(*) from auth.users) || ' contas, ' || (select count(*) from public.academies) || ' academias, '
       || (select count(*) from public.feed_posts) || ' fotos no feed, ' || (select count(*) from public.charges) || ' cobrancas' as situacao;

-- 9) Termos ainda em rascunho (lembrete): a versão aceita pelas pessoas fica registrada em terms_acceptances.
select '9. Versoes de termos aceitas (lembrete: rascunho exige revisao juridica)' as verificacao,
       coalesce(string_agg(distinct version, ', '), 'nenhuma aceita ainda') as situacao
from public.terms_acceptances;
