"use server";

import { revalidatePath } from "next/cache";
import { assessSkillSchema } from "@dojo/contracts/curriculum";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../../../login/actions";

// Teacher / manager sets the mastery status of a member. The database checks the assess_skills permission.
export async function assessSkill(academyId: string, userId: string, techniqueId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = assessSkillSchema.safeParse({
    academyId,
    userId,
    techniqueId,
    status: formData.get("status"),
    note: formData.get("note") ?? undefined,
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { error: "Revise o status e a observação (até 500 caracteres)." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("assess_skill", {
    p_academy_id: parsed.data.academyId,
    p_user_id: parsed.data.userId,
    p_technique_id: parsed.data.techniqueId,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    if (error.code === "42501" && error.message.includes("self")) return { error: "Ninguém valida o próprio domínio." };
    if (error.code === "22023" && error.message.includes("reason")) return { error: "Para remover uma validação, escreva o motivo na observação." };
    return { error: rpcErrorMessage(error) };
  }
  revalidatePath(`/academia/${academyId}/avaliacoes/${userId}`);
  return { message: "Salvo." };
}
