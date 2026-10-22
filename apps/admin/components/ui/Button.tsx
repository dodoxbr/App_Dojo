import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "accent";
  /** Mostra o indicador de carregamento e bloqueia novos cliques. O texto (ex.: "Entrando…") fica por conta de quem usa. */
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({ variant = "primary", loading = false, fullWidth = false, className, disabled, children, type = "button", ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], fullWidth ? styles.full : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button {...rest} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}

// Link com a aparência de botão (navegação, não ação): mesmas variantes do Button.
export function ButtonLink({ href, variant = "primary", fullWidth = false, children }: { href: string; variant?: ButtonProps["variant"]; fullWidth?: boolean; children: ReactNode }) {
  const classes = [styles.button, styles[variant], fullWidth ? styles.full : ""].filter(Boolean).join(" ");
  return <Link href={href} className={`${classes} ${styles.link}`}>{children}</Link>;
}
