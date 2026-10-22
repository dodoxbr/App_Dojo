import { redirect } from "next/navigation";
import { AuthShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

// Só chega aqui quem abriu o link do e-mail (a rota /auth/callback abriu a sessão de recuperação). Sem sessão, pede um link novo.
export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/recuperar-senha?erro=link");
  return (
    <AuthShell title="Escolha uma nova senha" subtitle="Use pelo menos 8 caracteres. Ao salvar, você entra de novo com a senha nova.">
      <ResetForm />
    </AuthShell>
  );
}
