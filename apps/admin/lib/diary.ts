import type { SupabaseClient } from "@supabase/supabase-js";

export type TechniqueRef = { id: string; name: string; category: string };

// Loads the technique names linked to each log (RLS: only what the caller may see).
export async function techniquesByLog(supabase: SupabaseClient, logIds: string[]) {
  const byLog = new Map<string, TechniqueRef[]>();
  if (logIds.length === 0) return byLog;
  const { data: links } = await supabase.from("training_log_techniques").select("log_id, technique_id").in("log_id", logIds);
  const ids = [...new Set((links ?? []).map((l) => l.technique_id as string))];
  const { data: techniques } = ids.length
    ? await supabase.from("techniques").select("id, name, category").in("id", ids)
    : { data: [] as TechniqueRef[] };
  const byId = new Map((techniques ?? []).map((t) => [t.id as string, t as TechniqueRef]));
  for (const l of links ?? []) {
    const t = byId.get(l.technique_id as string);
    if (!t) continue;
    byLog.set(l.log_id as string, [...(byLog.get(l.log_id as string) ?? []), t]);
  }
  return byLog;
}

export async function approvedAcademies(supabase: SupabaseClient, userId: string) {
  const { data: m } = await supabase.from("memberships").select("academy_id").eq("user_id", userId).eq("status", "approved");
  const ids = (m ?? []).map((x) => x.academy_id as string);
  if (ids.length === 0) return [] as { id: string; name: string }[];
  const { data } = await supabase.from("academies").select("id, name").in("id", ids).order("name");
  return (data ?? []) as { id: string; name: string }[];
}
