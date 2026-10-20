"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyConsentSchema } from "@dojo/contracts/guardians";
import { getCaller } from "@/lib/context";

// The manager confirms the guardian's document was checked in person. Nothing from the document is stored.
export async function verifyConsent(academyId: string, formData: FormData): Promise<void> {
  const parsed = verifyConsentSchema.safeParse({
    consentId: formData.get("consentId"),
    documentChecked: formData.get("documentChecked") === "on",
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) redirect(`/academia/${academyId}/responsaveis?erro=22023`);
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("verify_guardian_consent", {
    p_consent_id: parsed.data.consentId,
    p_document_checked: parsed.data.documentChecked,
    p_note: parsed.data.note ?? null,
  });
  revalidatePath(`/academia/${academyId}/responsaveis`);
  revalidatePath(`/academia/${academyId}/membros`);
  redirect(`/academia/${academyId}/responsaveis${error ? `?erro=${error.code === "42501" ? "42501" : error.code === "23505" ? "23505" : "other"}` : ""}`);
}
