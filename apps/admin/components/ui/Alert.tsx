import type { ReactNode } from "react";
import styles from "./Alert.module.css";

// Aviso em bloco. danger = erro (anuncia na hora), success = confirmação, info = orientação. As cores são semânticas
// e não mudam com a cor da academia.
export function Alert({ tone = "info", children }: { tone?: "danger" | "success" | "info"; children: ReactNode }) {
  const role = tone === "danger" ? "alert" : tone === "success" ? "status" : "note";
  return <div role={role} className={`${styles.alert} ${styles[tone]}`}>{children}</div>;
}
