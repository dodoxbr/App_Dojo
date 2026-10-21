import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

// Estado vazio: diz o que falta e, se houver, a próxima ação.
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.box}>
      <p className={styles.title}>{title}</p>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
