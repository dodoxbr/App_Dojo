"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@dojo/contracts/membership";
import { isValidSignature } from "@dojo/contracts/terms";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

// O adulto autoriza o uso da própria imagem no feed interno da academia (nome completo digitado, data e versão do texto ficam guardados).
export async function giveImageConsent(academyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!idSchema.safeParse(academyId).success) return { error: "Academia inválida." };
  if (formData.get("agree") !== "on") return { error: "Marque que você leu e concorda." };
  const signature = String(formData.get("signature") ?? "");
  if (!isValidSignature(signature)) return { error: "Assine digitando o seu nome completo (nome e sobrenome)." };
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("give_image_consent", { p_academy_id: academyId, p_signature: signature });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath("/perfil");
  return { message: "Autorização registrada." };
}

// Revogar: as fotos em que a pessoa está marcada saem do feed.
export async function revokeImageConsent(academyId: string): Promise<FormState> {
  if (!idSchema.safeParse(academyId).success) return { error: "Academia inválida." };
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("revoke_image_consent", { p_academy_id: academyId });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath("/perfil");
  return {};
}
