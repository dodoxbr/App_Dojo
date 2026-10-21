import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import styles from "./TextField.module.css";

// Lista de escolha com rótulo, no mesmo visual do TextField.
export function SelectField({ label, children, ...select }: Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.control}>
        <select {...select} id={id} className={styles.input}>{children}</select>
      </div>
    </div>
  );
}
