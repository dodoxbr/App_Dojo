import { buildRankHistory, promotionEventLabels, type PromotionEvent } from "@dojo/contracts/graduation";
import { Badge, EmptyState } from "@/components/ui";
import styles from "./rank-history.module.css";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

// Full, append-only history of official rank events. Corrected events stay visible, marked as replaced.
export function RankHistory({ events }: { events: PromotionEvent[] }) {
  const { history, current } = buildRankHistory(events);
  if (history.length === 0) return <EmptyState title="Nenhuma graduação registrada" />;
  return (
    <ol className={styles.timeline}>
      {history.map((e) => (
        <li key={e.id} className={`${styles.event} ${e.superseded ? styles.superseded : ""}`}>
          <p className={styles.when}>{fmt(e.effective_date)}</p>
          <p className={styles.what}>
            {promotionEventLabels[e.event_type] ?? e.event_type}: <strong>{e.belt_code} · grau {e.degree}</strong>
            {e.previous_belt_code ? ` (antes: ${e.previous_belt_code} · grau ${e.previous_degree})` : ""}
          </p>
          {(e.superseded || e.id === current?.id) && (
            <Badge tone={e.superseded ? "neutral" : "accent"}>{e.superseded ? "substituído por uma retificação" : "graduação atual"}</Badge>
          )}
          {e.reason && <p className={styles.reason}>{e.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
