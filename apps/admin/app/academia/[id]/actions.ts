"use server";

import { revalidatePath } from "next/cache";
import { academyLegalSchema, instructorPermissionSchema, themeSchema } from "@dojo/contracts/academy";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../../login/actions";

export async function updateSettings(academyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = themeSchema.safeParse({
    name: formData.get("name"),
    themePrimary: formData.get("themePrimary"),
    themeSecondary: formData.get("themeSecondary"),
  });
  if (!parsed.success) {
    const contrast = parsed.error.issues.some((i) => i.path.includes("themeSecondary") && i.message.includes("Contraste"));
    return { error: contrast ? "Contraste insuficiente entre as cores (mínimo 4,5:1)." : "Revise o nome e as cores." };
  }

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("update_academy_settings", {
    p_academy_id: academyId,
    p_name: parsed.data.name,
    p_theme_primary: parsed.data.themePrimary,
    p_theme_secondary: parsed.data.themeSecondary,
  });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/academia/${academyId}`);
  return { message: "Configurações salvas." };
}

export async function updateLegal(academyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = academyLegalSchema.safeParse({ legalName: formData.get("legalName"), cnpj: formData.get("cnpj") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a razão social e o CNPJ." };
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("set_academy_legal", {
    p_academy_id: academyId,
    p_legal_name: parsed.data.legalName,
    p_cnpj: parsed.data.cnpj,
  });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/academia/${academyId}`);
  return { message: "Dados da empresa salvos. Eles já aparecem nos termos da academia." };
}

// Liga ou desliga o PAR-Q obrigatório: ligado, quem tem o PAR-Q vencido (ou nunca respondeu) não consegue pedir check-in até responder de novo.
export async function setParqRequired(academyId: string, formData: FormData): Promise<void> {
  const { supabase } = await getCaller();
  await supabase.rpc("set_parq_required", { p_academy_id: academyId, p_on: formData.get("on") === "true" });
  revalidatePath(`/academia/${academyId}`);
  revalidatePath(`/academia/${academyId}/saude`);
}

export async function setPermission(academyId: string, permission: string, granted: boolean) {
  const parsed = instructorPermissionSchema.safeParse(permission);
  if (!parsed.success) return;
  const { supabase } = await getCaller();
  await supabase.rpc("set_instructor_permission", {
    p_academy_id: academyId,
    p_permission: parsed.data,
    p_granted: granted,
  });
  revalidatePath(`/academia/${academyId}`);
}
