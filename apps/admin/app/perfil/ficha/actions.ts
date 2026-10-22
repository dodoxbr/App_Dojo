"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { safeRedirectPath } from "@dojo/contracts/auth";
import { saveContactSchema } from "@dojo/contracts/contacts";
import { CURRENT_TERMS_VERSION } from "@dojo/contracts/terms";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../../login/actions";

// The person fills their own ficha; the legal guardian fills the minor's (the database checks who may).
export async function saveContact(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = saveContactSchema.safeParse({
    userId,
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    postalCode: formData.get("postalCode"),
    street: formData.get("street"),
    number: formData.get("number"),
    complement: formData.get("complement") ?? undefined,
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    state: formData.get("state"),
    emergencyName: formData.get("emergencyName"),
    emergencyPhone: formData.get("emergencyPhone"),
    emergencyRelationship: formData.get("emergencyRelationship"),
    healthNotes: formData.get("healthNotes") ?? undefined,
    healthConsent: formData.get("healthConsent") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os campos da ficha." };

  const { supabase } = await getCaller();
  const c = parsed.data;
  const { error } = await supabase.rpc("save_contact", {
    p_user_id: c.userId,
    p_full_name: c.fullName,
    p_phone: c.phone,
    p_postal_code: c.postalCode,
    p_street: c.street,
    p_number: c.number,
    p_complement: c.complement ?? null,
    p_neighborhood: c.neighborhood,
    p_city: c.city,
    p_state: c.state,
    p_emergency_name: c.emergencyName,
    p_emergency_phone: c.emergencyPhone,
    p_emergency_relationship: c.emergencyRelationship,
    p_health_notes: c.healthNotes ?? null,
    p_health_consent: c.healthConsent,
  });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath("/perfil");
  revalidatePath("/dependentes");
  // Salvou: volta para onde a pessoa estava (o perfil, ou o menor na ficha do dependente).
  redirect(safeRedirectPath(formData.get("next"), "/perfil"));
}

// Accounts created before the terms existed accept the current version here.
export async function acceptTerms(): Promise<void> {
  const { supabase } = await getCaller();
  await supabase.rpc("accept_terms", { p_version: CURRENT_TERMS_VERSION });
  revalidatePath("/perfil");
}
