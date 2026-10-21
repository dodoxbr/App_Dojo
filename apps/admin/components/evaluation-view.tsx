import type { ReactNode } from "react";
import { criterionKindLabels, progressText, type Evaluation } from "@dojo/contracts/graduation";
import { Alert, Badge, EmptyState, ProgressBar } from "@/components/ui";
import styles from "./evaluation-view.module.css";

// Read-only view of public.evaluate_promotion. `extra` lets the caller add controls under a criterion.
export function EvaluationView({ evaluation, extra }: { evaluation: Evaluation; extra?: (label: string, kind: string) => ReactNode }) {
  if (!evaluation.has_rank) {
    return <EmptyState title="Nenhuma graduação registrada">O gestor precisa registrar de onde esta pessoa parte para o progresso poder ser calculado.</EmptyState>;
  }
  const rank = evaluation.rank!;
  const since = new Date(`${rank.effective_date}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  if (!evaluation.has_rule) {
    return (
      <p>
        Graduação atual: <strong>{rank.belt_code} · grau {rank.degree}</strong>. A academia ainda não cadastrou uma regra para este ponto, então não há avaliação
        de progresso.
      </p>
    );
  }
  return (
    <div className={styles.wrap}>
      <p className={styles.rank}>
        Graduação atual: <strong>{rank.belt_code} · grau {rank.degree}</strong> (desde {since}) · regra versão {evaluation.rule!.version}
        {evaluation.rule!.title ? ` — ${evaluation.rule!.title}` : ""}
      </p>
      <Alert tone={evaluation.eligible ? "success" : "info"}>
        <strong>{evaluation.eligible ? "Todos os critérios atendidos." : "Ainda há critérios a atender."}</strong>{" "}
        Isto é uma recomendação: a promoção depende de decisão do gestor.
      </Alert>
      <ul className={styles.criteria}>
        {(evaluation.criteria ?? []).map((c) => (
          <li key={c.id} className={styles.criterion}>
            <div className={styles.head}>
              <strong>{c.label}</strong>
              <Badge tone={c.met ? "success" : "neutral"}>{c.met ? "atendido" : "a atender"}</Badge>
            </div>
            <p className={styles.kind}>{criterionKindLabels[c.kind]} — {progressText(c)}</p>
            {c.kind !== "manual" && c.target ? <ProgressBar value={c.current ?? 0} max={c.target} label={c.label} /> : null}
            {extra?.(c.label, c.kind)}
          </li>
        ))}
      </ul>
    </div>
  );
}
