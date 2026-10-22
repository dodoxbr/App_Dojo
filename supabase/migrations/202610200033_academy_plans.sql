-- Pacotes por academia (ideia do dono do produto, 2026-10-21): cada academia tem um PACOTE que liga ou desliga funcionalidades opcionais.
-- Decisões: (1) o núcleo nunca é desligado (conta, filiação, turmas e aulas, presença, diário, técnicas, graduação, menores e
-- responsáveis, saúde, termos); (2) a proteção de menores NÃO é item de pacote; (3) no alpha todas as academias começam no pacote
-- "avancado" (tudo ligado); (4) o conteúdo dos pacotes é valor de TESTE até o dono do produto definir (o super admin edita no painel).
-- Aplicação no BANCO: quem cria dado de uma funcionalidade desligada é barrado por gatilhos nas tabelas (erro 0A000 FEATURE_DISABLED),
-- inclusive por funções chamadas direto. O que o pacote NÃO faz: esconder dado que já existe; a leitura fica a cargo da tela
-- (não há ganho de acesso, só empacotamento de produto). Apagar e moderar continuam permitidos com a funcionalidade desligada.
-- Códigos de erro: 28000 UNAUTHENTICATED, 42501 FORBIDDEN, 22023 VALIDATION_ERROR, 0A000 FEATURE_DISABLED.

-- Catálogo de funcionalidades opcionais (a mesma lista vale no código: packages/contracts/src/features.ts)
create function public.feature_catalog() returns table (feature text, label text)
language sql immutable set search_path = '' as $$
  select * from (values
    ('finance', 'Financeiro manual'),
    ('feed', 'Feed de fotos, reações e comentários'),
    ('challenges', 'Desafios entre alunos'),
    ('medals', 'Medalhas'),
    ('dashboard', 'Painel de frequência e indicadores'),
    ('curriculum', 'Trilhas e avaliações de domínio'),
    ('milestone', 'Aviso de treinos por professor')
  ) as t(feature, label);
$$;

create table public.plans (
  code text primary key check (code ~ '^[a-z_]{3,30}$'),
  name text not null check (length(btrim(name)) between 2 and 40),
  position int not null,
  features text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint plans_features_chk check (features <@ array['finance', 'feed', 'challenges', 'medals', 'dashboard', 'curriculum', 'milestone']::text[])
);
alter table public.plans enable row level security;
create policy plans_read on public.plans for select to authenticated using (true);
grant select on public.plans to authenticated;

-- Pacotes iniciais (VALORES DE TESTE)
insert into public.plans (code, name, position, features) values
  ('inicial', 'Inicial', 1, '{}'),
  ('intermediario', 'Intermediário', 2, array['finance', 'dashboard', 'curriculum', 'milestone']),
  ('avancado', 'Avançado', 3, array['finance', 'feed', 'challenges', 'medals', 'dashboard', 'curriculum', 'milestone']);

alter table public.academies add column plan_code text not null default 'avancado' references public.plans(code);

-- A academia tem a funcionalidade? Interna (usada pelos gatilhos e pelas telas via academy_features).
create function public.academy_has_feature(p_academy_id uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.academies a join public.plans p on p.code = a.plan_code
                 where a.id = p_academy_id and p_feature = any (p.features));
$$;

-- Funcionalidades ligadas da academia: quem é da academia (membro aprovado), o gestor, o responsável legal de um menor com
-- consentimento nela e o super admin.
create function public.academy_features(p_academy_id uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (public.is_platform_admin() or public.is_approved_member(p_academy_id) or public.is_academy_manager(p_academy_id)
          or exists (select 1 from public.guardian_consents c join public.guardianships g on g.minor_user_id = c.minor_user_id and g.kind = 'legal'
                     where c.academy_id = p_academy_id and g.guardian_user_id = v_actor)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((select p.features from public.academies a join public.plans p on p.code = a.plan_code where a.id = p_academy_id), '{}');
end;
$$;

-- Das academias em que a pessoa tem papel (membro, gestor ou responsável), o pacote e as funcionalidades de cada uma.
create function public.my_academy_features() returns table (academy_id uuid, plan_code text, features text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  return query
    select a.id, a.plan_code, p.features
    from public.academies a join public.plans p on p.code = a.plan_code
    where a.id in (select m.academy_id from public.memberships m where m.user_id = (select auth.uid()) and m.status = 'approved')
       or a.id in (select c.academy_id from public.guardian_consents c join public.guardianships g on g.minor_user_id = c.minor_user_id and g.kind = 'legal'
                   where g.guardian_user_id = (select auth.uid()));
end;
$$;

-- Escolher o pacote de uma academia (só o super admin; auditado).
create function public.set_academy_plan(p_academy_id uuid, p_plan_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_old text;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select plan_code into v_old from public.academies where id = p_academy_id;
  if not found then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.plans where code = p_plan_code) then raise exception 'VALIDATION_ERROR: plan' using errcode = '22023'; end if;
  if v_old = p_plan_code then return; end if;
  update public.academies set plan_code = p_plan_code where id = p_academy_id;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (p_academy_id, v_actor, 'academy.plan', 'academies', p_academy_id, jsonb_build_object('from', v_old, 'to', p_plan_code));
end;
$$;

-- Editar o que um pacote inclui (só o super admin; auditado). Só funcionalidades do catálogo.
create function public.update_plan_features(p_code text, p_features text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_features text[] := coalesce(array(select distinct f from unnest(coalesce(p_features, '{}')) as f order by f), '{}');
  v_old text[];
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select features into v_old from public.plans where code = p_code;
  if not found then raise exception 'VALIDATION_ERROR: plan' using errcode = '22023'; end if;
  if exists (select 1 from unnest(v_features) as f where f not in (select feature from public.feature_catalog())) then
    raise exception 'VALIDATION_ERROR: feature' using errcode = '22023';
  end if;
  update public.plans set features = v_features, updated_at = now() where code = p_code;
  insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
    values (null, v_actor, 'plan.features', 'plans', null, jsonb_build_object('plan', p_code, 'from', to_jsonb(v_old), 'to', to_jsonb(v_features)));
end;
$$;

-- Gatilhos: criar dado de uma funcionalidade desligada é barrado no banco (qualquer caminho, inclusive RPC direto).
create function public.require_feature() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_academy uuid := (to_jsonb(new) ->> 'academy_id')::uuid;
begin
  if v_academy is not null and not public.academy_has_feature(v_academy, tg_argv[0]) then
    raise exception 'FEATURE_DISABLED: %', tg_argv[0] using errcode = '0A000';
  end if;
  return new;
end;
$$;

-- Tabelas filhas do feed não têm academy_id: a academia vem do post.
create function public.require_feature_feed_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_post uuid;
  v_academy uuid;
begin
  v_post := case tg_table_name
    when 'feed_comment_reports' then (select c.post_id from public.feed_comments c where c.id = (to_jsonb(new) ->> 'comment_id')::uuid)
    else (to_jsonb(new) ->> 'post_id')::uuid end;
  select f.academy_id into v_academy from public.feed_posts f where f.id = v_post;
  if v_academy is not null and not public.academy_has_feature(v_academy, 'feed') then
    raise exception 'FEATURE_DISABLED: feed' using errcode = '0A000';
  end if;
  return new;
end;
$$;

create trigger require_finance before insert on public.charges for each row execute function public.require_feature('finance');
create trigger require_finance before insert on public.charge_events for each row execute function public.require_feature('finance');
create trigger require_finance before insert or update on public.member_plans for each row execute function public.require_feature('finance');
create trigger require_feed before insert on public.feed_posts for each row execute function public.require_feature('feed');
create trigger require_feed before insert on public.feed_reactions for each row execute function public.require_feature_feed_child();
create trigger require_feed before insert on public.feed_comments for each row execute function public.require_feature_feed_child();
create trigger require_feed before insert on public.feed_reports for each row execute function public.require_feature_feed_child();
create trigger require_feed before insert on public.feed_comment_reports for each row execute function public.require_feature_feed_child();
create trigger require_challenges before insert on public.challenges for each row execute function public.require_feature('challenges');
create trigger require_challenges before insert on public.challenge_participants for each row execute function public.require_feature('challenges');
create trigger require_challenges before insert on public.challenge_entries for each row execute function public.require_feature('challenges');
create trigger require_curriculum before insert on public.curricula for each row execute function public.require_feature('curriculum');
create trigger require_curriculum before insert on public.curriculum_items for each row execute function public.require_feature('curriculum');
create trigger require_curriculum before insert or update on public.skill_assessments for each row execute function public.require_feature('curriculum');
create trigger require_milestone before insert or update on public.milestone_settings for each row execute function public.require_feature('milestone');

-- A geração automática de mensalidades (pg_cron) pula as academias sem o financeiro, em vez de falhar a rodada inteira.
create or replace function public.run_auto_charges() returns int
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  v_month date;
  v_created int;
  v_total int := 0;
begin
  for a in select id, owner_user_id from public.academies where auto_charges and public.academy_has_feature(id, 'finance') loop
    v_month := date_trunc('month', public.academy_today(a.id))::date;
    v_created := public.generate_charges_core(a.id, v_month, a.owner_user_id);
    if v_created > 0 then
      insert into public.audit_events (academy_id, actor_user_id, action, entity, entity_id, metadata)
        values (a.id, a.owner_user_id, 'finance.generate', 'charges', null, jsonb_build_object('month', v_month, 'created', v_created, 'auto', true));
      v_total := v_total + v_created;
    end if;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.feature_catalog(), public.academy_has_feature(uuid, text), public.academy_features(uuid), public.my_academy_features(),
  public.set_academy_plan(uuid, text), public.update_plan_features(text, text[]), public.require_feature(), public.require_feature_feed_child(),
  public.run_auto_charges() from public, anon, authenticated;
grant execute on function public.feature_catalog(), public.academy_features(uuid), public.my_academy_features(),
  public.set_academy_plan(uuid, text), public.update_plan_features(text, text[]) to authenticated;
