import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCaller } from "@/lib/context";

// Members of the academy with the number of skills validated. Needs assess_skills or view_progress (+ the roster).
export default async function AvaliacoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getCaller();

  const [{ data: canAssess }, { data: canView }] = await Promise.all([
    supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "assess_skills" }),
    supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "view_progress" }),
  ]);
  if (canAssess !== true && canView !== true) redirect("/perfil");

  const { data: academy } = await supabase.from("academies").select("id, name").eq("id", id).maybeSingle();
  if (!academy) notFound();

  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("academy_id", id)
    .eq("status", "approved")
    .eq("role", "student");
  const userIds = (members ?? []).map((m) => m.user_id as string);
  const [{ data: profiles }, { data: assessments }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
    supabase.from("skill_assessments").select("user_id, status").eq("academy_id", id).eq("status", "validated"),
  ]);
  const validatedBy = new Map<string, number>();
  for (const a of assessments ?? []) validatedBy.set(a.user_id as string, (validatedBy.get(a.user_id as string) ?? 0) + 1);
  const people = (profiles ?? [])
    .map((p) => ({ id: p.id as string, name: p.display_name as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 640 }}>
      <p><Link href={`/academia/${id}`}>← {academy.name}</Link></p>
      <h1>Avaliações de domínio</h1>
      <p>A avaliação técnica é independente da presença e não define graduação.</p>
      {people.length === 0 ? (
        <p>Nenhum aluno aprovado visível. Para ver a lista é preciso a permissão de ver a lista de alunos.</p>
      ) : (
        <ul>
          {people.map((p) => (
            <li key={p.id}>
              <Link href={`/academia/${id}/avaliacoes/${p.id}`}>{p.name}</Link> — {validatedBy.get(p.id) ?? 0} técnicas validadas
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
