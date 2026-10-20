"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { displayNameSchema } from "@dojo/contracts/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "../login/actions";

export async function updateDisplayName(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = displayNameSchema.safeParse(formData.get("displayName"));
  if (!parsed.success) return { error: "O nome deve ter de 2 a 120 caracteres." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // RLS and column grants restrict this to the caller's own display_name.
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data }).eq("id", data.claims.sub);
  if (error) return { error: "Não foi possível salvar o nome." };
  revalidatePath("/perfil");
  return { message: "Nome atualizado." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
