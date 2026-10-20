import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { evaluationSchema } from "@dojo/contracts/graduation";
import { idSchema } from "@dojo/contracts/membership";
import { EvaluationView } from "@/components/evaluation-view";
import { getCaller } from "@/lib/context";
import { ManualCriterionForm } from "../../forms";

export default async function AvaliacaoAlunoPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  if (!idSchema.safeParse(userId).success) notFound();
  const { supabase } = await getCaller();

  const { data: canRecommend } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "recommend_graduation" });
  const { data: canView } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "view_progress" });
  if (canRecommend !== true && canView !== true) redirect("/perfil");

  const [{ data: profile }, { data: raw, error }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.rpc("evaluate_promotion", { p_academy_id: id, p_user_id: userId }),
  ]);
  if (!profile) notFound();
  const parsed = evaluationSchema.safeParse(raw);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 800 }}>
      <p><Link href={`/academia/${id}/graduacao/alunos`}>← Alunos</Link></p>
      <h1>{profile.display_name}</h1>
      {error || !parsed.success ? (
        <p role="alert">Não foi possível calcular a avaliação.</p>
      ) : (
        <EvaluationView
          evaluation={parsed.data}
          extra={
            canRecommend === true
              ? (label, kind) => (kind === "manual" ? <div><ManualCriterionForm academyId={id} userId={userId} label={label} /></div> : null)
              : undefined
          }
        />
      )}
    </main>
  );
}
