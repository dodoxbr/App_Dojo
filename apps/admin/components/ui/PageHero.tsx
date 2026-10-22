import type { ReactNode } from "react";
import { Hero } from "./Hero";
import styles from "./PageHero.module.css";

// Cabeçalho de destaque de uma tela (fundo marinho): linha pequena, título, apoio, uma peça à direita (anel, avatar…) e ações.
export function PageHero({ eyebrow, title, subtitle, aside, children, actions }: { eyebrow?: string; title: string; subtitle?: ReactNode; aside?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <Hero>
      <div className={styles.top}>
        <div className={styles.text}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
      {actions && <div className={styles.actions}>{actions}</div>}
    </Hero>
  );
}
