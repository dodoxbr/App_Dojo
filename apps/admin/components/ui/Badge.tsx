import type { ReactNode } from "react";
import styles from "./Badge.module.css";

// Etiqueta curta de estado (ex.: faixa, "Pendente", "Aprovada"). As cores são semânticas.
export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "success" | "danger" | "info"; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
