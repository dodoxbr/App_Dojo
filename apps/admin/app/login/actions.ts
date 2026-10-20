"use server";

import { redirect } from "next/navigation";
import { isAdultOn, safeRedirectPath, signInSchema, signUpSchema } from "@dojo/contracts/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string };

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe um e-mail válido e senha com 8 ou mais caracteres." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha inválidos, ou e-mail ainda não confirmado." };
  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe nome (2 a 120 caracteres), data de nascimento válida, e-mail válido e senha com 8 ou mais caracteres." };

  const supabase = await createClient();
  const { email, password, displayName, birthDate, forMinor, dependentName, dependentBirthDate } = parsed.data;
  // The account of a minor is always created by an adult guardian, never by the minor.
  if (forMinor && !isAdultOn(birthDate)) return { error: "Quem cuida de um menor precisa ter 18 anos ou mais. Peça a um responsável adulto para criar a conta." };
  // The minor's data is only a prefill kept in the sign-up metadata; the dependent is created (and validated) after the e-mail is confirmed.
  const data: Record<string, string> = { display_name: displayName, birth_date: birthDate };
  if (forMinor && dependentName) data.dependent_name = dependentName;
  if (forMinor && dependentBirthDate) data.dependent_birth_date = dependentBirthDate;
  const { error } = await supabase.auth.signUp({ email, password, options: { data } });
  if (error) return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  // Same message whether or not the e-mail already exists.
  return {
    message: forMinor
      ? "Cadastro recebido. Confirme seu e-mail, entre e conclua o cadastro do menor em \"Meus dependentes\"."
      : "Cadastro recebido. Confira seu e-mail para confirmar a conta.",
  };
}
