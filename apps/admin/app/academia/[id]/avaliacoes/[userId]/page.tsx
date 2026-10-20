import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { skillStatusLabels, summarizeTrail, type SkillStatus } from "@dojo/contracts/curriculum";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { AssessForm } from "../assess-form";

export default async function AvaliarAlunoPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  if (!idSchema.safeParse(userId).success) notFound();
  const { supabase } = await getCaller();

  const [{ data: canAssess }, { data: canView }] = await Promise.all([
    supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "assess_skills" }),
    supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "view_progress" }),
  ]);
  if (canAssess !== true && canView !== true) redirect("/perfil");

  const [{ data: profile }, { data: curricula }, { data: items }, { data: assessments }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("curricula").select("id, title, level").eq("academy_id", id).eq("is_active", true).order("title"),
    supabase.from("curriculum_items").select("curriculum_id, technique_id, required, position").eq("academy_id", id).order("position"),
    supabase.from("skill_assessments").select("technique_id, status, status_source, note").eq("academy_id", id).eq("user_id", userId),
  ]);
  if (!profile) notFound();

  const techniqueIds = [...new Set((items ?? []).map((i) => i.technique_id as string))];
  const { data: techniques } = techniqueIds.length
    ? await supabase.from("techniques").select("id, name, category").in("id", techniqueIds)
    : { data: [] };
  const techniqueOf = new Map((techniques ?? []).map((t) => [t.id as string, t]));
  const byTechnique = new Map((assessments ?? []).map((a) => [a.technique_id as string, a]));
  const status = new Map((assessments ?? []).map((a) => [a.technique_id as string, a.status as string]));

  return (
    <main style={{ padding: 16, display: "grid", gap: 24, maxWidth: 800 }}>
      <p><Link href={`/academia/${id}/avaliacoes`}>← Avaliações</Link></p>
      <h1>{profile.display_name}</h1>
      {canAssess !== true && <p role="note">Você pode ver o progresso, mas não tem permissão para avaliar.</p>}

      {(curricula ?? []).length === 0 && <p>A academia ainda não tem currículo ativo.</p>}
      {(curricula ?? []).map((c) => {
        const cItems = (items ?? []).filter((i) => i.curriculum_id === c.id);
        const summary = summarizeTrail(
          cItems.map((i) => ({ techniqueId: i.technique_id as string, required: i.required as boolean })),
          status,
        );
        return (
          <section key={c.id as string}>
            <h2>{c.title}{c.level ? ` · ${c.level}` : ""}</h2>
            <p>Validadas: {summary.requiredValidated} de {summary.required} obrigatórias ({summary.validated} de {summary.total} no total)</p>
            <ul>
              {cItems.map((i) => {
                const t = techniqueOf.get(i.technique_id as string);
                const a = byTechnique.get(i.technique_id as string);
                const current = (a?.status ?? "not_started") as SkillStatus;
                return (
                  <li key={`${c.id}-${i.technique_id}`}>
                    {t?.name as string}{i.required ? "" : " (opcional)"} — {skillStatusLabels[current]}
                    {a ? ` (${a.status_source === "self" ? "declarado pelo aluno" : "avaliado por professor"})` : ""}
                    {a?.note ? ` · ${a.note}` : ""}
                    {canAssess === true && (
                      <div>
                        <AssessForm academyId={id} userId={userId} techniqueId={i.technique_id as string} current={current} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
