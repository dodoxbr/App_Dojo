import type { SupabaseClient } from "@supabase/supabase-js";

// Approved instructors and managers of an academy, with names (visible to the academy's manager / platform admin).
export async function instructorCandidates(supabase: SupabaseClient, academyId: string) {
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("academy_id", academyId)
    .eq("status", "approved")
    .in("role", ["instructor", "manager"]);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (ids.length === 0) return [] as { id: string; name: string }[];
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  return (profiles ?? [])
    .map((p) => ({ id: p.id as string, name: p.display_name as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
