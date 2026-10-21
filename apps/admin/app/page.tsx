import Link from "next/link";

// The confirmation link of the sign-up e-mail lands here (Supabase "Site URL"): `?code=` means the address was confirmed and
// `?error=` means the link expired or was already used. Fixed texts only: nothing from the URL is shown.
export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string; error?: string; error_code?: string }> }) {
  const { code, error, error_code } = await searchParams;
  const failed = Boolean(error || error_code);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 560 }}>
      <h1>Dojo Platform — Painel</h1>
      {code && !failed && (
        <p role="status">
          E-mail confirmado. Agora <Link href="/login">entre com o seu e-mail e a sua senha</Link>.
        </p>
      )}
      {failed && (
        <p role="alert">
          Este link de confirmação venceu ou já foi usado. Se o seu e-mail já foi confirmado, <Link href="/login">entre com a sua senha</Link>;
          se não, crie a conta de novo na mesma tela.
        </p>
      )}
      <p><Link href="/login">Entrar</Link> · <Link href="/perfil">Meu perfil</Link></p>
    </main>
  );
}
