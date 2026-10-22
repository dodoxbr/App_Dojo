import type { ReactNode } from "react";
import { BeltBar } from "./BeltBar";
import { BrandLogo } from "./BrandLogo";
import { Card } from "./Card";
import styles from "./AuthShell.module.css";

const highlights = ["Presença validada pelo professor", "Diário de treino só seu", "Graduação oficial decidida pelo mestre"];

// Faixas decorativas (só enfeite da marca; não representam ninguém).
function Belts({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.belts} ${compact ? styles.beltsCompact : ""}`} aria-hidden="true">
      <BeltBar belt="Branca" size={compact ? "sm" : "md"} />
      <BeltBar belt="Azul" degree={2} size={compact ? "sm" : "md"} />
      <BeltBar belt="Roxa" degree={3} size={compact ? "sm" : "md"} />
      <BeltBar belt="Marrom" degree={1} size={compact ? "sm" : "md"} />
      <BeltBar belt="Preta" degree={4} size={compact ? "sm" : "md"} />
    </div>
  );
}

// Estrutura das telas de autenticação: painel da marca (desktop) ou faixa de marca no topo (celular) + card central.
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.compactBrand}>
        <BrandLogo tone="light" />
        <p className={styles.compactTagline}>Seu treino, sua evolução, sua academia.</p>
        <Belts compact />
      </div>
      <aside className={styles.brand}>
        {/* Logotipo enviado pelo dono do produto (provisório até a versão final): arquivos em public/brand, gerados por scripts/build-brand-assets.mjs */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/oss-lockup.png" alt="Oss, seu companheiro de treino" width={900} height={476} className={styles.lockup} />
        <div className={styles.pitch}>
          <h2 className={styles.headline}>Seu treino, sua evolução, sua academia.</h2>
          <p className={styles.lead}>A plataforma das academias de Jiu-Jitsu: acompanhe seus treinos e a sua jornada com a confiança de quem valida cada passo.</p>
          <ul className={styles.highlights}>
            {highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
        <Belts />
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
