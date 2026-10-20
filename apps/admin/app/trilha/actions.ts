"use server";

import { revalidatePath } from "next/cache";
import { declareSkillSchema } from "@dojo/contracts/curriculum";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

// The student declares their own progress. "validated" is rejected here and in the database.
export async function declareSkill(academyId: string, techniqueId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = declareSkillSchema.safeParse({ academyId, techniqueId, status: formData.get("status") });
  if (!parsed.success) return { error: "Escolha: não iniciada, estudada ou praticando." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("declare_skill", {
    p_academy_id: parsed.data.academyId,
    p_technique_id: parsed.data.techniqueId,
    p_status: parsed.data.status,
  });
  if (error) {
    return { error: rpcErrorMessage(error, { conflict: "O professor já validou esta técnica; só ele pode alterar." }) };
  }
  revalidatePath("/trilha");
  return { message: "Salvo." };
}
