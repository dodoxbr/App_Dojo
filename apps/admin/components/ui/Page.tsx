import type { ReactNode } from "react";
import styles from "./Page.module.css";

// Conteúdo principal de uma tela dentro do AppShell. `width`: estreito (formulários e listas) ou padrão (painéis).
export function Page({ children, width = "default" }: { children: ReactNode; width?: "narrow" | "default" }) {
  return <main className={`${styles.page} ${width === "narrow" ? styles.narrow : ""}`}>{children}</main>;
}
