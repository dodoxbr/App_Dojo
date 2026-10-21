import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./ItemLink.module.css";

// Linha clicável de uma lista (técnica, registro do diário, aula…): título, apoio, etiquetas e texto curto.
export function ItemLink({ href, title, meta, badges, children }: { href: string; title: ReactNode; meta?: ReactNode; badges?: ReactNode; children?: ReactNode }) {
  return (
    <Link href={href} className={styles.item}>
      <span className={styles.head}>
        <strong className={styles.title}>{title}</strong>
        {meta && <span className={styles.meta}>{meta}</span>}
      </span>
      {badges && <span className={styles.badges}>{badges}</span>}
      {children && <span className={styles.body}>{children}</span>}
    </Link>
  );
}

// Lista sem marcadores para ItemLink e blocos parecidos.
export function ItemList({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}
