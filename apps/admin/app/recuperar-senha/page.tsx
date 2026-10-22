import { AuthShell } from "@/components/ui";
import { ForgotForm } from "./forgot-form";

export default async function RecuperarSenhaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <AuthShell title="Recuperar a senha" subtitle="Informe o e-mail da sua conta. Enviamos um link para você escolher uma nova senha.">
      <ForgotForm linkExpired={erro === "link"} />
    </AuthShell>
  );
}
