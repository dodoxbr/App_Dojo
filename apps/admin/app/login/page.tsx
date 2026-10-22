import { safeRedirectPath } from "@dojo/contracts/auth";
import { AuthShell } from "@/components/ui";
import { LoginForms } from "./login-forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; aba?: string; senha?: string }> }) {
  const { next, aba, senha } = await searchParams;
  return (
    <AuthShell title="Acesse a sua conta" subtitle="Entre ou crie a sua conta para acompanhar seus treinos, sua academia e sua evolução.">
      <LoginForms next={safeRedirectPath(next, "/inicio")} initialTab={aba === "criar" ? "criar" : "entrar"} passwordChanged={senha === "ok"} />
    </AuthShell>
  );
}
