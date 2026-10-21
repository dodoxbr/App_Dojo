import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./TextField.module.css";

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  /** Texto de ajuda sob o campo (ex.: regra da senha). */
  hint?: ReactNode;
  /** Mensagem de erro do campo; marca o campo como inválido para leitores de tela. */
  error?: string;
  /** Conteúdo à direita dentro do campo (ex.: botão de mostrar a senha). */
  trailing?: ReactNode;
};

export function TextField({ label, hint, error, trailing, className, ...input }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={[styles.field, className ?? ""].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.control}>
        <input {...input} id={id} className={styles.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} data-has-trailing={trailing ? "" : undefined} />
        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>
      {hint && !error && <p id={hintId} className={styles.hint}>{hint}</p>}
      {error && <p id={errorId} className={styles.error}>{error}</p>}
    </div>
  );
}
