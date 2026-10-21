import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./CheckField.module.css";

// Caixa de marcar com texto clicável (o texto pode ter links). Alvo de toque de pelo menos 44 px.
export function CheckField({ children, className, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & { children: ReactNode }) {
  const id = useId();
  return (
    <div className={[styles.row, className ?? ""].filter(Boolean).join(" ")}>
      <input {...input} id={id} type="checkbox" className={styles.box} />
      <label htmlFor={id} className={styles.text}>{children}</label>
    </div>
  );
}
