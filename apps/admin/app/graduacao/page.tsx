import { evaluationSchema, type PromotionEvent } from "@dojo/contracts/graduation";
import { RankHistory } from "@/components/rank-history";
import { EvaluationView } from "@/components/evaluation-view";
import { Alert, Card, EmptyState, Page, PageHeader } from "@/components/ui";
import { getCaller } from "@/lib/context";

// The student's own progress against the academy's rule for their current rank. A recommendation, never a promotion.
export default async function GraduacaoAlunoPage() {
  const { supabase, userId } = await getCaller();
  const { data: mem } = await supabase.from("memberships").select("academy_id").eq("user_id", userId).eq("status", "approved");
  const academyIds = (mem ?? []).map((m) => m.academy_id as string);
  const { data: academies } = academyIds.length
    ? await supabase.from("academies").select("id, name").in("id", academyIds).order("name")
    : { data: [] };

  const results = await Promise.all(
    (academies ?? []).map(async (a) => {
      const [{ data }, { data: events }] = await Promise.all([
        supabase.rpc("evaluate_promotion", { p_academy_id: a.id, p_user_id: userId }),
        supabase.from("promotions")
          .select("id, event_type, belt_code, degree, effective_date, created_at, corrects_promotion_id, reason, previous_belt_code, previous_degree")
          .eq("academy_id", a.id).eq("user_id", userId),
      ]);
      return {
        academy: a as { id: string; name: string },
        evaluation: evaluationSchema.safeParse(data),
        events: (events ?? []) as PromotionEvent[],
      };
    }),
  );

  return (
    <Page width="narrow">
      <PageHeader
        title="Minha graduação"
        subtitle="Sua graduação oficial é registrada pelo gestor da academia; você não a altera. Abaixo, o seu progresso nos critérios que a academia definiu. Só contam presenças confirmadas pelo professor."
      />
      {results.length === 0 && <EmptyState title="Você ainda não faz parte de nenhuma academia">Peça ao gestor da sua academia o link de entrada.</EmptyState>}
      {results.map(({ academy, evaluation, events }) => (
        <Card key={academy.id}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.25rem" }}>{academy.name}</h2>
          {evaluation.success ? <EvaluationView evaluation={evaluation.data} /> : <Alert tone="danger">Não foi possível calcular o seu progresso.</Alert>}
          <h3 style={{ margin: "24px 0 12px", fontSize: "1rem" }}>Histórico de graduações</h3>
          <RankHistory events={events} />
        </Card>
      ))}
    </Page>
  );
}
