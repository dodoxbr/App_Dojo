import type { ReactNode } from "react";
import { Card } from "./Card";
import styles from "./AuthShell.module.css";

const highlights = ["Presença validada pelo professor", "Diário de treino só seu", "Graduação oficial decidida pelo mestre"];

// Estrutura das telas de autenticação: painel da marca (desktop) ou faixa de marca no topo (celular) + card central.
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.compactBrand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/oss-site-logo.webp" alt="Oss, seu companheiro de treino" width={1000} height={547} className={styles.logoSite} />
        <p className={styles.compactTagline}>Seu treino, sua evolução, sua academia.</p>
      </div>
      <aside className={styles.brand}>
        {/* Logotipo (provisório até a versão final), com fundo escuro próprio: `lighten` o funde ao painel sólido */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/oss-site-logo.webp" alt="Oss, seu companheiro de treino" width={1000} height={547} className={styles.logoSite} />
        <div className={styles.pitch}>
          <h2 className={styles.headline}>Seu treino, sua evolução, sua academia.</h2>
          <p className={styles.lead}>A plataforma das academias de Jiu-Jitsu: acompanhe seus treinos e a sua jornada com a confiança de quem valida cada passo.</p>
          <ul className={styles.highlights}>
            {highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
        <p className={styles.legal}>Oss, a saudação do tatame.</p>
      </aside>
      <section className={styles.panel} aria-labelledby="auth-title">
        <Card className={styles.card}>
          <h1 id="auth-title" className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          {children}
        </Card>
      </section>
    </main>
  );
}
