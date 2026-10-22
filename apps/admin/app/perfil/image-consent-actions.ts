"use server";

import { revalidatePath } from "next/cache";
import { DECLARATIONS_VERSION } from "@dojo/contracts/terms";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

// Conta antiga (ou quem não declarou no cadastro): lê e declara a saúde. O banco guarda a data e a versão.
export async function declareHealth(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("agree") !== "on") return { error: "Leia e marque a declaração de saúde." };
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("declare_health", { p_version: DECLARATIONS_VERSION });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath("/perfil");
  return {};
}

// Autoriza ou revoga a própria imagem no feed interno. Revogar tira do feed as fotos em que a pessoa está marcada.
export async function setImageAuthorization(_prev: FormState, formData: FormData): Promise<FormState> {
  const on = formData.get("on") === "true";
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("set_image_authorization", { p_on: on, p_version: DECLARATIONS_VERSION });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath("/perfil");
  return {};
}
