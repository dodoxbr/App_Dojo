"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";

// Quem tem a permissão de ver saúde marca que conferiu o atestado médico físico (o banco confere a permissão e registra na auditoria).
export async function markCertificate(academyId: string, userId: string): Promise<void> {
  if (!idSchema.safeParse(academyId).success || !idSchema.safeParse(userId).success) return;
  const { supabase } = await getCaller();
  await supabase.rpc("mark_medical_certificate", { p_academy_id: academyId, p_user_id: userId });
  revalidatePath(`/academia/${academyId}/saude`);
  revalidatePath(`/academia/${academyId}/saude/parq/${userId}`);
}
