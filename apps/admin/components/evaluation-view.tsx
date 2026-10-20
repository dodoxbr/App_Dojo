import type { ReactNode } from "react";
import { criterionKindLabels, progressText, type Evaluation } from "@dojo/contracts/graduation";

// Read-only view of public.evaluate_promotion. `extra` lets the caller add controls under a criterion.
export function EvaluationView({ evaluation, extra }: { evaluation: Evaluation; extra?: (label: string, kind: string) => ReactNode }) {
  if (!evaluation.has_rank) return <p>Nenhuma graduação registrada para esta pessoa ainda. O gestor precisa registrar de onde ela parte.</p>;
  const rank = evaluation.rank!;
  if (!evaluation.has_rule) {
    return (
      <p>
        Graduação atual: <strong>{rank.belt_code} · grau {rank.degree}</strong>. A academia ainda não cadastrou uma regra para este ponto, então não há avaliação.
      </p>
    );
  }
  return (
    <div>
      <p>
        Graduação atual: <strong>{rank.belt_code} · grau {rank.degree}</strong> (desde{" "}
        {new Date(`${rank.effective_date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}) · regra versão {evaluation.rule!.version}
        {evaluation.rule!.title ? ` — ${evaluation.rule!.title}` : ""}
      </p>
      <p role="status">
        <strong>{evaluation.eligible ? "Todos os critérios atendidos." : "Ainda há critérios a atender."}</strong>{" "}
        Isto é uma recomendação: a promoção depende de decisão do gestor.
      </p>
      <ul>
        {(evaluation.criteria ?? []).map((c) => (
          <li key={c.id}>
            {c.met ? "✔" : "✘"} <strong>{c.label}</strong> ({criterionKindLabels[c.kind]}) — {progressText(c)}
            {extra?.(c.label, c.kind)}
          </li>
        ))}
      </ul>
    </div>
  );
}
