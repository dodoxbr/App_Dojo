import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

// Who is the caller? Used to decide what to render; authorization itself is enforced by RLS/RPC.
export async function getCaller() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const userId = data.claims.sub;

  const [admin, creator, managed] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase.from("academy_creators").select("user_id").eq("user_id", userId).is("revoked_at", null).maybeSingle(),
    supabase
      .from("memberships")
      .select("academy_id")
      .eq("user_id", userId)
      .eq("role", "manager")
      .eq("status", "approved"),
  ]);

  const managedIds = (managed.data ?? []).map((m) => m.academy_id as string);
  const academies = managedIds.length
    ? await supabase.from("academies").select("id, name, slug").in("id", managedIds).order("name")
    : { data: [] as { id: string; name: string; slug: string }[] };

  return {
    supabase,
    userId,
    isPlatformAdmin: admin.data === true,
    canCreateAcademy: admin.data === true || !!creator.data,
    managedAcademies: academies.data ?? [],
  };
}
