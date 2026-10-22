"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { knownFeatures, setPlanSchema } from "@dojo/contracts/features";
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

// Pacotes por academia (só o super admin; o banco confere de novo e audita).
export async function setAcademyPlan(formData: FormData) {
  const parsed = setPlanSchema.safeParse({ academyId: formData.get("academyId"), planCode: formData.get("planCode") });
  if (!parsed.success) redirect("/plataforma?erro=plano");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("set_academy_plan", { p_academy_id: parsed.data.academyId, p_plan_code: parsed.data.planCode });
  revalidatePath("/plataforma");
  redirect(error ? "/plataforma?erro=plano" : "/plataforma?ok=plano");
}

export async function savePlanFeatures(formData: FormData) {
  const code = String(formData.get("planCode") ?? "");
  const features = knownFeatures(formData.getAll("features").map(String));
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("update_plan_features", { p_code: code, p_features: features });
  revalidatePath("/plataforma/pacotes");
  redirect(error ? "/plataforma/pacotes?erro=pacote" : "/plataforma/pacotes?ok=pacote");
}
