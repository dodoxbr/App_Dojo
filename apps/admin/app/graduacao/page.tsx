import Link from "next/link";
import { evaluationSchema, type PromotionEvent } from "@dojo/contracts/graduation";
import { RankHistory } from "@/components/rank-history";
import { EvaluationView } from "@/components/evaluation-view";
import { getCaller } from "@/lib/context";
import { AppShell } from "@/components/shell/AppShell";

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
    <AppShell>
      <main style={{ padding: 16, display: "grid", gap: 24, maxWidth: 720 }}>
      <p><Link href="/perfil">← Meu perfil</Link></p>
      <h1>Minha graduação</h1>
      <p>
        Sua graduação oficial é registrada pelo gestor da academia; você não a altera. Abaixo, o seu progresso nos critérios que a
        academia definiu. Só contam presenças confirmadas pelo professor.
      </p>
      {results.length === 0 && <p>Você ainda não faz parte de nenhuma academia.</p>}
      {results.map(({ academy, evaluation, events }) => (
        <section key={academy.id}>
          <h2>{academy.name}</h2>
          {evaluation.success ? <EvaluationView evaluation={evaluation.data} /> : <p role="alert">Não foi possível calcular o seu progresso.</p>}
          <h3>Histórico de graduações</h3>
          <RankHistory events={events} />
        </section>
      ))}
    </main>
    </AppShell>
  );
}
