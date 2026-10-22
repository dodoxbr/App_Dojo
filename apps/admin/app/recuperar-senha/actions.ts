"use server";

import { passwordResetRequestSchema } from "@dojo/contracts/auth";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "../login/actions";

// Pede o e-mail de redefinição. A resposta é SEMPRE a mesma, exista a conta ou não (não revela quem tem cadastro).
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Informe um e-mail válido." };

  const supabase = await createClient();
  const redirectTo = `${await siteUrl()}/auth/callback?next=/redefinir-senha`;
  // O erro do Supabase (conta inexistente, limite de envios…) não muda a resposta mostrada.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  return { message: "Se este e-mail tiver cadastro, enviamos um link para redefinir a senha. Ele vale por pouco tempo. Confira também a caixa de spam." };
}
