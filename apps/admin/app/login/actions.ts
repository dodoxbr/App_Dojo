"use server";

import { redirect } from "next/navigation";
import { signInSchema, signUpSchema } from "@dojo/contracts/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string };

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe um e-mail válido e senha com 8 ou mais caracteres." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha inválidos, ou e-mail ainda não confirmado." };
  redirect("/perfil");
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe nome (2 a 120 caracteres), e-mail válido e senha com 8 ou mais caracteres." };

  const supabase = await createClient();
  const { email, password, displayName } = parsed.data;
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
  if (error) return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  // Same message whether or not the e-mail already exists.
  return { message: "Cadastro recebido. Confira seu e-mail para confirmar a conta." };
}
