import { beltPaint } from "@dojo/contracts/belts";
import styles from "./BeltBar.module.css";

// Faixa desenhada com a cor do nome que a academia cadastrou (só visual; sem cor conhecida, fica turquesa neutra), a ponta preta e
// um risco branco por grau (até 6). Decorativa: o texto da graduação vem sempre ao lado (aria-hidden).
export function BeltBar({ belt, degree = 0, size = "md" }: { belt: string | null | undefined; degree?: number; size?: "sm" | "md" | "lg" }) {
  const paint = beltPaint(belt);
  const base = paint?.base ?? "var(--accent)";
  const isBlack = base === "#15181D";
  const stripes = Math.max(0, Math.min(degree, 6));
  return (
    <div className={`${styles.belt} ${styles[size]}`} aria-hidden="true" style={{ background: base }}>
      {paint?.stripe && <span className={styles.stripe} style={{ background: paint.stripe }} />}
      <span className={`${styles.tip} ${isBlack ? styles.tipRed : ""}`}>
        {Array.from({ length: stripes }, (_, i) => <i key={i} className={styles.degree} />)}
      </span>
    </div>
  );
}
