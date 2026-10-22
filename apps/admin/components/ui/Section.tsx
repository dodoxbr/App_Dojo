import type { ReactNode } from "react";
import styles from "./Section.module.css";

// Bloco de uma tela de gestão: cartão com título (e apoio opcional). Os formulários e listas antigos dentro dele herdam o visual da ponte.
export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {hint && <p className={styles.hint}>{hint}</p>}
      {children}
    </section>
  );
}
