"use server";

import { redirect } from "next/navigation";
import { newPasswordSchema } from "@dojo/contracts/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "../login/actions";

// Define a nova senha de quem chegou pelo link do e-mail (sessão de recuperação). Depois encerra todas as sessões
// e leva para entrar de novo com a senha nova.
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a nova senha (8 a 72 caracteres)." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Este link venceu ou já foi usado. Peça um novo em “Esqueci minha senha”." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const same = /different from the old password|same password/i.test(error.message);
    return { error: same ? "A nova senha precisa ser diferente da anterior." : "Não foi possível alterar a senha. Peça um novo link e tente de novo." };
  }
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?senha=ok");
}
