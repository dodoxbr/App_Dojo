import { safeRedirectPath } from "@dojo/contracts/auth";
import { LoginForms } from "./login-forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main style={{ padding: 16, display: "grid", gap: 24, maxWidth: 420 }}>
      <h1>Dojo Platform — Painel</h1>
      <LoginForms next={safeRedirectPath(next)} />
    </main>
  );
}
