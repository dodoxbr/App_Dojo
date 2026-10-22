import type { SupabaseClient } from "@supabase/supabase-js";
import { academyLogoUrl } from "@/lib/academy-logo";

export type ShellAcademy = { name: string; logoUrl: string | null };

// A academia que aparece no cabeçalho de todas as telas logadas (nome e logo). Só leitura; quem não é da academia não a recebe (RLS).
export async function shellAcademy(supabase: SupabaseClient, academyId: string): Promise<ShellAcademy | undefined> {
  const [{ data }, logoUrl] = await Promise.all([
    supabase.from("academies").select("name").eq("id", academyId).maybeSingle(),
    academyLogoUrl(supabase, academyId),
  ]);
  return data?.name ? { name: data.name as string, logoUrl } : undefined;
}
