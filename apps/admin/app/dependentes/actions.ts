"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { acceptFinancialSchema, createDependentSchema, requestDependentSchema } from "@dojo/contracts/guardians";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

export async function createDependent(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createDependentSchema.safeParse({
    displayName: formData.get("displayName"),
    birthDate: formData.get("birthDate"),
    relationship: formData.get("relationship"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Informe o nome, a data de nascimento (menor de 18 anos) e o parentesco." };
  }
  const { supabase } = await getCaller();
  const d = parsed.data;
  const { data, error } = await supabase.rpc("create_dependent", {
    p_display_name: d.displayName,
    p_birth_date: d.birthDate,
    p_relationship: d.relationship,
    p_idempotency_key: d.idempotencyKey,
  });
  if (error || !data) return { error: rpcErrorMessage(error ?? { message: "" }) };
  revalidatePath("/dependentes");
  redirect(`/dependentes/${data}`);
}

// The legal guardian asks for the minor's place in an academy and gives the consent (photos off unless ticked).
export async function requestForDependent(minorId: string, academyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = requestDependentSchema.safeParse({ minorId, academyId, photos: formData.get("photos") === "on" });
  if (!parsed.success) return { error: "Pedido inválido." };
  if (formData.get("consent") !== "on") return { error: "Marque que você leu e concorda com o termo de consentimento." };
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("request_dependent_membership", {
    p_minor_id: parsed.data.minorId,
    p_academy_id: parsed.data.academyId,
    p_photos: parsed.data.photos,
  });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/dependentes/${minorId}`);
  return { message: "Pedido enviado. Agora leve seu documento à academia: o gestor confere pessoalmente antes de aprovar." };
}

export async function revokeConsent(minorId: string, formData: FormData): Promise<void> {
  const consentId = formData.get("consentId");
  if (!idSchema.safeParse(minorId).success || !idSchema.safeParse(consentId).success) return;
  const { supabase } = await getCaller();
  await supabase.rpc("revoke_guardian_consent", { p_consent_id: consentId });
  revalidatePath(`/dependentes/${minorId}`);
}

// The code is shown once; it identifies the invite, not a person, and expires in 7 days.
export async function createInvite(minorId: string): Promise<FormState> {
  if (!idSchema.safeParse(minorId).success) return { error: "Pedido inválido." };
  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("create_financial_invite", { p_minor_id: minorId });
  const row = (data as { code: string }[] | null)?.[0];
  if (error || !row) return { error: rpcErrorMessage(error ?? { message: "" }) };
  return { message: `Código do responsável financeiro: ${row.code} (vale por 7 dias e só pode ser usado uma vez). Envie ao outro responsável.` };
}

export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptFinancialSchema.safeParse({ code: formData.get("code"), relationship: formData.get("relationship") });
  if (!parsed.success) return { error: "Informe o código de 10 letras/números e o seu parentesco." };
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("accept_financial_invite", { p_code: parsed.data.code, p_relationship: parsed.data.relationship });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath("/dependentes");
  return { message: "Pronto: você agora é o responsável financeiro." };
}
