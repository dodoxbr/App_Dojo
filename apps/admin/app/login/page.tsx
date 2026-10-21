import { safeRedirectPath } from "@dojo/contracts/auth";
import { BrandLogo, Card } from "@/components/ui";
import { LoginForms } from "./login-forms";
import styles from "./login.module.css";

const highlights = [
  "Presença validada pelo professor",
  "Diário de treino só seu",
  "Graduação oficial decidida pelo mestre",
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; aba?: string }> }) {
  const { next, aba } = await searchParams;
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
          <h1 id="auth-title" className={styles.title}>Acesse a sua conta</h1>
          <p className={styles.subtitle}>Entre ou crie a sua conta para acompanhar seus treinos, sua academia e sua evolução.</p>
          <LoginForms next={safeRedirectPath(next)} initialTab={aba === "criar" ? "criar" : "entrar"} />
        </Card>
      </section>
    </main>
  );
}
