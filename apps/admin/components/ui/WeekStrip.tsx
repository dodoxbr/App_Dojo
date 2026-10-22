import type { WeekDay } from "@dojo/contracts/week";
import styles from "./WeekStrip.module.css";

// Os 7 dias da semana: marcado = houve treino confirmado pelo professor naquele dia. Hoje fica em destaque.
export function WeekStrip({ days, trained }: { days: WeekDay[]; trained: Set<string> }) {
  return (
    <ol className={styles.strip} aria-label="Treinos confirmados nesta semana">
      {days.map((d) => {
        const done = trained.has(d.date);
        return (
          <li key={d.date} className={`${styles.day} ${d.isToday ? styles.today : ""} ${done ? styles.done : ""} ${d.isFuture ? styles.future : ""}`}>
            <span className={styles.label}>{d.label}</span>
            <span className={styles.dot} aria-hidden="true">{done ? "✓" : d.date.slice(8)}</span>
            <span className={styles.sr}>{done ? "treino confirmado" : d.isFuture ? "ainda não chegou" : "sem treino confirmado"}</span>
          </li>
        );
      })}
    </ol>
  );
}
