import Link from "next/link";
import { redirect } from "next/navigation";
import { academiesWith, myFeatureMap } from "@/lib/features";
import { getCaller } from "@/lib/context";
import { CreateChallengeForm } from "../forms";

export default async function NovoDesafioPage() {
  const { supabase, userId } = await getCaller();
  const { data: ageStatus } = await supabase.rpc("my_age_status");
  if (ageStatus !== "adult") redirect("/desafios");

  const { data: mem } = await supabase.from("memberships").select("academy_id").eq("user_id", userId).eq("status", "approved");
  const features = await myFeatureMap(supabase);
  const ids = academiesWith(features, (mem ?? []).map((m) => m.academy_id as string), "challenges");
  if (ids.length === 0) redirect("/desafios");
  const [{ data: academies }, { data: techniques }] = await Promise.all([
    supabase.from("academies").select("id, name").in("id", ids).order("name"),
    // techniques usable in a technique challenge: the catalog the person can see
    supabase.rpc("search_techniques", { p_limit: 100, p_offset: 0 }),
  ]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 560 }}>
      <p><Link href="/desafios">← Desafios</Link></p>
      <h1>Criar desafio</h1>
      <p>Você define o que vale ponto e quanto. O sistema não traz valores prontos.</p>
      <CreateChallengeForm
        academies={(academies ?? []).map((a) => ({ id: a.id as string, label: a.name as string }))}
        techniques={((techniques ?? []) as { id: string; name: string; category: string }[]).map((t) => ({ id: t.id, label: `${t.name} — ${t.category}` }))}
      />
    </main>
  );
}
