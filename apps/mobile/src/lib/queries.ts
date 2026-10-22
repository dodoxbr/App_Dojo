import { evaluationSchema, type Evaluation } from '@dojo/contracts/graduation';
import { supabase } from './supabase';

// Consultas do app. Tudo passa pelo banco com a sessão da pessoa: a RLS decide o que ela vê (o app só mostra).

export type AcademyRef = { id: string; name: string; timezone: string };
export type Membership = { academy_id: string; status: string; role: string };
export type RankRow = { belt_code: string; degree: number };

async function ok<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  const { data, error } = await p;
  if (error) throw new Error('Não foi possível carregar os dados. Tente de novo.');
  return data;
}

export async function loadMemberships(userId: string) {
  const memberships = ((await ok(supabase.from('memberships').select('academy_id, status, role').eq('user_id', userId))) ?? []) as Membership[];
  const ids = [...new Set(memberships.map((m) => m.academy_id))];
  const academies = ids.length ? (((await ok(supabase.from('academies').select('id, name, timezone').in('id', ids).order('name'))) ?? []) as AcademyRef[]) : [];
  return { memberships, academies };
}

export async function loadHome(userId: string) {
  const [{ data: profile }, { memberships, academies }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    loadMemberships(userId),
  ]);
  const approved = new Set(memberships.filter((m) => m.status === 'approved' && m.role === 'student').map((m) => m.academy_id));
  const primary = academies.find((a) => approved.has(a.id)) ?? null;
  const now = new Date();

  let rank: RankRow | null = null;
  let evaluation: Evaluation | null = null;
  let recentStarts: string[] = [];
  let next: { id: string; title: string; starts_at: string; ends_at: string } | null = null;
  if (primary) {
    const since = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const [rankRes, evalRes, validated, upcoming] = await Promise.all([
      supabase.from('current_ranks').select('belt_code, degree').eq('academy_id', primary.id).eq('user_id', userId).maybeSingle(),
      supabase.rpc('evaluate_promotion', { p_academy_id: primary.id, p_user_id: userId }),
      supabase.from('attendances').select('session_id').eq('academy_id', primary.id).eq('user_id', userId).eq('status', 'validated'),
      supabase.from('sessions').select('id, class_id, starts_at, ends_at').eq('academy_id', primary.id).eq('status', 'scheduled').gte('starts_at', now.toISOString()).order('starts_at').limit(1),
    ]);
    rank = (rankRes.data as RankRow | null) ?? null;
    const parsed = evaluationSchema.safeParse(evalRes.data);
    evaluation = parsed.success ? parsed.data : null;
    const ids = ((validated.data ?? []) as { session_id: string }[]).map((a) => a.session_id);
    if (ids.length) {
      const { data: recent } = await supabase.from('sessions').select('starts_at').in('id', ids).gte('starts_at', since);
      recentStarts = ((recent ?? []) as { starts_at: string }[]).map((s) => s.starts_at);
    }
    const first = ((upcoming.data ?? []) as { id: string; class_id: string; starts_at: string; ends_at: string }[])[0];
    if (first) {
      const { data: cls } = await supabase.from('classes').select('title').eq('id', first.class_id).maybeSingle();
      next = { id: first.id, title: (cls?.title as string | undefined) ?? 'Aula', starts_at: first.starts_at, ends_at: first.ends_at };
    }
  }

  const { data: logs } = await supabase.from('training_logs').select('id, trained_at, notes').eq('user_id', userId).order('trained_at', { ascending: false }).limit(3);
  return {
    firstName: (((profile?.display_name as string | undefined) ?? '').split(' ')[0] || 'atleta'),
    primary,
    rank,
    evaluation,
    recentStarts,
    nowIso: now.toISOString(),
    next,
    logs: (logs ?? []) as { id: string; trained_at: string; notes: string | null }[],
    waiting: memberships.filter((m) => m.status !== 'approved').map((m) => ({ ...m, name: academies.find((a) => a.id === m.academy_id)?.name ?? 'A academia' })),
  };
}

export type TechniqueRow = { id: string; name: string; category: string; level: string | null; technique_type: string | null; technique_position: string | null; matched_alias: string | null };

export async function searchTechniques(query: string, limit = 30, offset = 0): Promise<TechniqueRow[]> {
  const { data, error } = await supabase.rpc('search_techniques', { p_query: query.trim().slice(0, 100) || null, p_limit: limit, p_offset: offset });
  if (error) throw new Error('Não foi possível buscar as técnicas.');
  return (data ?? []) as TechniqueRow[];
}

export async function loadTechnique(id: string) {
  const { data, error } = await supabase
    .from('techniques')
    .select('id, name, category, level, description, technique_type, technique_position, reviewed, classification_status, academy_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('Não foi possível carregar a técnica.');
  return data as { id: string; name: string; category: string; level: string | null; description: string | null; technique_type: string | null; technique_position: string | null; reviewed: boolean; classification_status: string | null; academy_id: string | null } | null;
}

export async function loadDiary(userId: string, page: number, size = 20) {
  const { data, error } = await supabase
    .from('training_logs')
    .select('id, academy_id, trained_at, notes')
    .eq('user_id', userId)
    .order('trained_at', { ascending: false })
    .range((page - 1) * size, page * size); // uma linha a mais indica que há próxima página
  if (error) throw new Error('Não foi possível carregar o diário.');
  const rows = (data ?? []) as { id: string; academy_id: string | null; trained_at: string; notes: string | null }[];
  const logs = rows.slice(0, size);
  return { logs, hasNext: rows.length > size, techniques: await techniquesByLog(logs.map((l) => l.id)) };
}

export async function techniquesByLog(logIds: string[]) {
  const byLog = new Map<string, { id: string; name: string }[]>();
  if (!logIds.length) return byLog;
  const { data: links } = await supabase.from('training_log_techniques').select('log_id, technique_id').in('log_id', logIds);
  const ids = [...new Set(((links ?? []) as { technique_id: string }[]).map((l) => l.technique_id))];
  const { data: techs } = ids.length ? await supabase.from('techniques').select('id, name').in('id', ids) : { data: [] };
  const byId = new Map(((techs ?? []) as { id: string; name: string }[]).map((t) => [t.id, t]));
  for (const l of (links ?? []) as { log_id: string; technique_id: string }[]) {
    const t = byId.get(l.technique_id);
    if (t) byLog.set(l.log_id, [...(byLog.get(l.log_id) ?? []), t]);
  }
  return byLog;
}

export async function loadLog(userId: string, id: string) {
  const { data } = await supabase.from('training_logs').select('id, academy_id, trained_at, notes').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!data) return null;
  const techniques = (await techniquesByLog([id])).get(id) ?? [];
  let academyName: string | null = null;
  if (data.academy_id) {
    const { data: a } = await supabase.from('academies').select('name').eq('id', data.academy_id as string).maybeSingle();
    academyName = (a?.name as string | undefined) ?? null;
  }
  return { ...(data as { id: string; academy_id: string | null; trained_at: string; notes: string | null }), techniques, academyName };
}

export async function loadEvolution(userId: string) {
  const { memberships, academies } = await loadMemberships(userId);
  const approved = new Set(memberships.filter((m) => m.status === 'approved' && m.role === 'student').map((m) => m.academy_id));
  return Promise.all(
    academies.filter((a) => approved.has(a.id)).map(async (academy) => {
      const [evalRes, events] = await Promise.all([
        supabase.rpc('evaluate_promotion', { p_academy_id: academy.id, p_user_id: userId }),
        supabase
          .from('promotions')
          .select('id, event_type, belt_code, degree, effective_date, created_at, corrects_promotion_id, reason, previous_belt_code, previous_degree')
          .eq('academy_id', academy.id)
          .eq('user_id', userId),
      ]);
      const parsed = evaluationSchema.safeParse(evalRes.data);
      return { academy, evaluation: parsed.success ? parsed.data : null, events: (events.data ?? []) as never[] };
    }),
  );
}

export async function loadAgenda(userId: string) {
  const { memberships, academies } = await loadMemberships(userId);
  const ids = memberships.filter((m) => m.status === 'approved').map((m) => m.academy_id);
  if (!ids.length) return { academies, sessions: [], status: new Map<string, string>(), titles: new Map<string, string>(), nowMs: Date.now() };
  const now = Date.now();
  const from = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: sessions }, { data: classes }] = await Promise.all([
    supabase.from('sessions').select('id, academy_id, class_id, starts_at, ends_at, status').in('academy_id', ids).gte('ends_at', from).lte('starts_at', to).order('starts_at').limit(100),
    supabase.from('classes').select('id, title').in('academy_id', ids),
  ]);
  const list = (sessions ?? []) as { id: string; academy_id: string; class_id: string; starts_at: string; ends_at: string; status: string }[];
  const { data: mine } = list.length ? await supabase.from('attendances').select('session_id, status').eq('user_id', userId).in('session_id', list.map((s) => s.id)) : { data: [] };
  return {
    nowMs: now, // lido junto com os dados (e não na renderização) para a tela não depender do relógio a cada desenho
    academies,
    sessions: list,
    status: new Map(((mine ?? []) as { session_id: string; status: string }[]).map((a) => [a.session_id, a.status])),
    titles: new Map(((classes ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title])),
  };
}
