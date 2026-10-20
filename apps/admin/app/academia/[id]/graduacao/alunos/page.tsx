import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCaller } from "@/lib/context";
import { RegisterRankForm } from "../forms";

// Students with their current official rank. The manager registers where each person stands today.
export default async function AlunosGraduacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, isPlatformAdmin, managedAcademies } = await getCaller();
  const isManager = isPlatformAdmin || managedAcademies.some((a) => a.id === id);
  const { data: canView } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "view_progress" });
  const { data: canRecommend } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "recommend_graduation" });
  if (!isManager && canView !== true && canRecommend !== true) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();

  const { data: members } = await supabase.from("memberships").select("user_id").eq("academy_id", id).eq("status", "approved").eq("role", "student");
  const userIds = (members ?? []).map((m) => m.user_id as string);
  const [{ data: profiles }, { data: ranks }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
    supabase.from("promotions").select("user_id, belt_code, degree, effective_date, created_at").eq("academy_id", id)
      .order("effective_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const current = new Map<string, { belt_code: string; degree: number; effective_date: string }>();
  for (const r of ranks ?? []) if (!current.has(r.user_id as string)) current.set(r.user_id as string, r as never);
  const people = (profiles ?? [])
    .map((p) => ({ id: p.id as string, name: p.display_name as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 800 }}>
      <p><Link href={`/academia/${id}/graduacao`}>← Graduação</Link></p>
      <h1>Alunos e graduação atual</h1>
      <p>A graduação oficial só é registrada pelo gestor. O aluno não altera a própria graduação.</p>
      {people.length === 0 ? (
        <p>Nenhum aluno aprovado visível. Para ver a lista é preciso a permissão de ver a lista de alunos.</p>
      ) : (
        <ul>
          {people.map((p) => {
            const r = current.get(p.id);
            return (
              <li key={p.id}>
                <Link href={`/academia/${id}/graduacao/alunos/${p.id}`}>{p.name}</Link> —{" "}
                {r ? (
                  <>
                    {r.belt_code} · grau {r.degree} (desde{" "}
                    {new Date(`${r.effective_date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })})
                  </>
                ) : isManager ? (
                  <RegisterRankForm academyId={id} userId={p.id} />
                ) : (
                  "sem graduação registrada"
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
