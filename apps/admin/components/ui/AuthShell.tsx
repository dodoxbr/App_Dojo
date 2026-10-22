import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { Card } from "./Card";
import styles from "./AuthShell.module.css";

const highlights = ["Presença validada pelo professor", "Diário de treino só seu", "Graduação oficial decidida pelo mestre"];

// Estrutura das telas de autenticação: painel da marca (desktop) + card central. Usada por login, recuperar e redefinir senha.
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <aside className={styles.brand}>
        <BrandLogo tone="light" />
        <div className={styles.pitch}>
          <h2 className={styles.headline}>Seu treino, sua evolução, sua academia.</h2>
          <p className={styles.lead}>A plataforma das academias de Jiu-Jitsu: acompanhe seus treinos e a sua jornada com a confiança de quem valida cada passo.</p>
          <ul className={styles.highlights}>
            {highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
        <p className={styles.legal}>Dojo Platform</p>
      </aside>
      <section className={styles.panel} aria-labelledby="auth-title">
        <div className={styles.compactBrand}><BrandLogo /></div>
        <Card className={styles.card}>
          <h1 id="auth-title" className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          {children}
        </Card>
      </section>
    </main>
  );
}
