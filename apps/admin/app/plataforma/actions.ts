"use server";

import { revalidatePath } from "next/cache";
import { grantCreatorSchema } from "@dojo/contracts/academy";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

export async function grantCreator(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = grantCreatorSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Informe um e-mail válido." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("grant_academy_creator", { p_email: parsed.data.email });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath("/plataforma");
  return { message: "Criador liberado." };
}

export async function revokeCreator(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const { supabase } = await getCaller();
  await supabase.rpc("revoke_academy_creator", { p_user_id: userId });
  revalidatePath("/plataforma");
}
