"use server";

import { revalidatePath } from "next/cache";
import { scheduleSchema } from "@dojo/contracts/academy-page";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../../../login/actions";

// Salva a grade de horários da página pública (só gestor ou super admin; o banco valida de novo e registra na auditoria).
export async function saveAcademySchedule(academyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!idSchema.safeParse(academyId).success) return { error: "Academia inválida." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("schedule") ?? "[]"));
  } catch {
    return { error: "Não foi possível ler a grade. Recarregue a página e tente de novo." };
  }
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a grade de horários." };
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("save_academy_schedule", { p_academy_id: academyId, p_schedule: parsed.data });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/academia/${academyId}/pagina`);
  return { message: "Grade de horários salva." };
}
