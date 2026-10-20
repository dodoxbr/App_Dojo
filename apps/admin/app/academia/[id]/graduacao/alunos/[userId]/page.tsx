import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buildRankHistory, evaluationSchema, type PromotionEvent } from "@dojo/contracts/graduation";
import { idSchema } from "@dojo/contracts/membership";
import { EvaluationView } from "@/components/evaluation-view";
import { RankHistory } from "@/components/rank-history";
import { getCaller } from "@/lib/context";
import { CorrectPromotionForm, GrantPromotionForm, ManualCriterionForm } from "../../forms";

export default async function AvaliacaoAlunoPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  if (!idSchema.safeParse(userId).success) notFound();
  const { supabase, isPlatformAdmin, managedAcademies, userId: callerId } = await getCaller();
  const isManager = isPlatformAdmin || managedAcademies.some((a) => a.id === id);

  const { data: canRecommend } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "recommend_graduation" });
  const { data: canView } = await supabase.rpc("has_academy_permission", { p_academy_id: id, p_permission: "view_progress" });
  if (canRecommend !== true && canView !== true) redirect("/perfil");

  const [{ data: profile }, { data: raw, error }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.rpc("evaluate_promotion", { p_academy_id: id, p_user_id: userId }),
    supabase.from("promotions")
      .select("id, event_type, belt_code, degree, effective_date, created_at, corrects_promotion_id, reason, previous_belt_code, previous_degree")
      .eq("academy_id", id).eq("user_id", userId),
  ]);
  if (!profile) notFound();
  const parsed = evaluationSchema.safeParse(raw);
  const { current } = buildRankHistory((events ?? []) as PromotionEvent[]);
  // Nobody changes their own graduation, not even the manager (the database enforces it too).
  const canDecide = isManager && userId !== callerId;

  return (
    <main style={{ padding: 16, display: "grid", gap: 24, maxWidth: 800 }}>
      <p><Link href={`/academia/${id}/graduacao/alunos`}>← Alunos</Link></p>
      <h1>{profile.display_name}</h1>

      <section>
        <h2>Progresso nos critérios</h2>
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
      </section>

      <section>
        <h2>Histórico de graduações</h2>
        <RankHistory events={(events ?? []) as PromotionEvent[]} />
      </section>

      {canDecide && current && (
        <>
          <section>
            <h2>Conceder graduação</h2>
            <p>
              Decisão do gestor, sempre com justificativa. A recomendação acima não é obrigatória, mas fica registrada junto com a
              concessão. A contagem de presenças e de dias recomeça na nova graduação.
            </p>
            <GrantPromotionForm
              academyId={id}
              userId={userId}
              current={{ beltCode: current.belt_code, degree: current.degree, effectiveDate: current.effective_date }}
            />
          </section>
          <section>
            <h2>Retificar o último registro</h2>
            <p>Corrige um erro criando um novo registro; o anterior continua no histórico.</p>
            <CorrectPromotionForm
              academyId={id}
              promotionId={current.id}
              current={{ beltCode: current.belt_code, degree: current.degree, effectiveDate: current.effective_date }}
            />
          </section>
        </>
      )}
      {isManager && !current && <p>Registre antes a graduação atual deste aluno na lista de alunos.</p>}
    </main>
  );
}
