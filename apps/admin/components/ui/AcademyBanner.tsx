import type { ReactNode } from "react";
import styles from "./AcademyBanner.module.css";

// Banner do perfil da academia: a logo ampliada e desfocada ao fundo, a logo redonda em destaque e o nome. Sem logo, fica o fundo da
// marca com a inicial. A imagem de fundo é decorativa (alt vazio); o nome vem sempre em texto.
export function AcademyBanner({ name, logoUrl, eyebrow, subtitle, children }: { name: string; logoUrl: string | null; eyebrow?: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className={styles.banner}>
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" aria-hidden="true" className={styles.backdrop} />
      )}
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.content}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`Logo de ${name}`} className={styles.logo} />
        ) : (
          <span className={styles.initial} aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span>
        )}
        <div className={styles.text}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.name}>{name}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {children && <div className={styles.actions}>{children}</div>}
        </div>
      </div>
    </header>
  );
}
