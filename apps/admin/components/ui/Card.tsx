import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

// Superfície elevada para agrupar conteúdo (card de autenticação, cartões do painel, etc.).
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={[styles.card, className ?? ""].filter(Boolean).join(" ")} />;
}
