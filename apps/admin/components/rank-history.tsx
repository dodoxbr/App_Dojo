import { promotionEventLabels, type PromotionEvent } from "@dojo/contracts/graduation";
import { buildRankHistory } from "@dojo/contracts/graduation";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

// Full, append-only history of official rank events. Corrected events stay visible, marked as replaced.
export function RankHistory({ events }: { events: PromotionEvent[] }) {
  const { history, current } = buildRankHistory(events);
  if (history.length === 0) return <p>Nenhuma graduação registrada.</p>;
  return (
    <ul>
      {history.map((e) => (
        <li key={e.id} style={e.superseded ? { opacity: 0.6 } : undefined}>
          {fmt(e.effective_date)} — {promotionEventLabels[e.event_type] ?? e.event_type}: <strong>{e.belt_code} · grau {e.degree}</strong>
          {e.previous_belt_code ? ` (antes: ${e.previous_belt_code} · grau ${e.previous_degree})` : ""}
          {e.superseded ? " — substituído por uma retificação" : e.id === current?.id ? " — graduação atual" : ""}
          {e.reason ? ` · ${e.reason}` : ""}
        </li>
      ))}
    </ul>
  );
}
