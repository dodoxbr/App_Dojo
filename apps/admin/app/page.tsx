import Link from "next/link";
import { Alert, BrandLogo, ButtonLink, Card } from "@/components/ui";
import styles from "./home.module.css";

// The confirmation link of the sign-up e-mail lands here (Supabase "Site URL"): `?code=` means the address was confirmed and
// `?error=` means the link expired or was already used. Fixed texts only: nothing from the URL is shown.
export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string; error?: string; error_code?: string }> }) {
  const { code, error, error_code } = await searchParams;
  const failed = Boolean(error || error_code);

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <BrandLogo />
        <h1 className={styles.title}>Oss!</h1>
        <p className={styles.lead}>Treino, presença e evolução da sua academia de Jiu-Jitsu.</p>
        {code && !failed && (
          <Alert tone="success">
            E-mail confirmado. Agora <Link href="/login">entre com o seu e-mail e a sua senha</Link>.
          </Alert>
        )}
        {failed && (
          <Alert tone="danger">
            Este link de confirmação venceu ou já foi usado. Se o seu e-mail já foi confirmado, <Link href="/login">entre com a sua senha</Link>;
            se não, crie a conta de novo na mesma tela.
          </Alert>
        )}
        <div className={styles.actions}>
          <ButtonLink href="/login">Entrar</ButtonLink>
          <ButtonLink href="/login?aba=criar" variant="secondary">Criar conta</ButtonLink>
        </div>
      </Card>
    </main>
  );
}
