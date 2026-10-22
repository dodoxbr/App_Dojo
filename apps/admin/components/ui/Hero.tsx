import type { ReactNode } from "react";
import styles from "./Hero.module.css";

// Cartão de destaque escuro (marinho) com uma trama discreta de listras; o texto dentro é claro.
export function Hero({ children }: { children: ReactNode }) {
  return <section className={styles.hero}>{children}</section>;
}
