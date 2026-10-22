import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { milestoneSettingSchema, milestoneStudentSchema, rankLabel } from "@dojo/contracts/milestone";
import { getCaller } from "@/lib/context";
import { MilestoneSettingForm, RegisterRankForm } from "../forms";

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
  const { data: milestoneRaw } = await supabase.rpc("list_milestone_students", { p_academy_id: id });
  const { data: settingRaw } = await supabase.rpc("get_my_milestone_setting", { p_academy_id: id });
  const setting = milestoneSettingSchema.safeParse(((settingRaw ?? []) as unknown[])[0]);
  const atMilestone = ((milestoneRaw ?? []) as unknown[]).map((x) => milestoneStudentSchema.safeParse(x)).flatMap((r) => (r.success ? [r.data] : []));

  const { data: members } = await supabase.from("memberships").select("user_id").eq("academy_id", id).eq("status", "approved").eq("role", "student");
  const userIds = (members ?? []).map((m) => m.user_id as string);
  const [{ data: profiles }, { data: ranks }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
    supabase.from("current_ranks").select("user_id, belt_code, degree, effective_date").eq("academy_id", id),
  ]);
  const current = new Map((ranks ?? []).map((r) => [r.user_id as string, r as { belt_code: string; degree: number; effective_date: string }]));
  const people = (profiles ?? [])
    .map((p) => ({ id: p.id as string, name: p.display_name as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 960 }}>
      <p><Link href={`/academia/${id}/graduacao`}>← Graduação</Link></p>
      <h1>Alunos e graduação atual</h1>
      <p>A graduação oficial só é registrada pelo gestor. O aluno não altera a própria graduação.</p>
      {setting.success && (
        <section>
          <h2>Aviso de treinos</h2>
          <p>Cada professor decide o seu número. O aluno recebe o aviso quando chega ao número de um dos professores das turmas em que treinou desde a última graduação; você vê os seus alunos{isManager ? " (como gestor, todos os alunos da academia)" : ""}. Sem escolha, o número é 30.</p>
          <MilestoneSettingForm academyId={id} threshold={setting.data.threshold} enabled={setting.data.enabled} />
        </section>
      )}
      {atMilestone.length > 0 && (
        <section role="status">
          <h2>Chegaram ao seu número de treinos desde a última graduação</h2>
          <ul>
            {atMilestone.map((s) => (
              <li key={s.user_id}>
                <Link href={`/academia/${id}/graduacao/alunos/${s.user_id}`}>{s.person_name}</Link>{s.is_minor ? " (menor de idade)" : ""} — {s.attendances} treinos · {rankLabel(s.belt_code, s.degree, s.rank_since)}
              </li>
            ))}
          </ul>
        </section>
      )}
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
