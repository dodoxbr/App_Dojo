"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { saveTrainingLogSchema, trainedDateToTimestamp } from "@dojo/contracts/diary";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

export type TechniqueOption = { id: string; name: string; category: string };

// Technique picker: same RLS-filtered search used by the catalog, small page.
export async function searchTechniqueOptions(query: string): Promise<TechniqueOption[]> {
  const q = query.trim().slice(0, 100);
  const { supabase } = await getCaller();
  const { data } = await supabase.rpc("search_techniques", { p_query: q || null, p_limit: 20, p_offset: 0 });
  return ((data ?? []) as TechniqueOption[]).map((t) => ({ id: t.id, name: t.name, category: t.category }));
}

export async function saveLog(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = saveTrainingLogSchema.safeParse({
    logId: formData.get("logId") ?? undefined,
    academyId: formData.get("academyId") ?? undefined,
    trainedDate: formData.get("trainedDate"),
    notes: formData.get("notes") ?? "",
    techniqueIds: formData.getAll("techniqueId"),
    clientKey: formData.get("clientKey"),
  });
  if (!parsed.success) return { error: "Revise a data (não pode ser futura), as anotações e as técnicas escolhidas." };

  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("save_training_log", {
    p_academy_id: parsed.data.academyId ?? null,
    p_trained_at: trainedDateToTimestamp(parsed.data.trainedDate),
    p_notes: parsed.data.notes,
    p_technique_ids: parsed.data.techniqueIds,
    p_client_key: parsed.data.clientKey,
    p_log_id: parsed.data.logId ?? null,
  });
  if (error || !data) return { error: rpcErrorMessage(error ?? {}) };
  revalidatePath("/diario");
  redirect(`/diario/${data}`);
}

export async function deleteLog(logId: string): Promise<void> {
  if (!idSchema.safeParse(logId).success) return;
  const { supabase, userId } = await getCaller();
  // Own entries only (RLS also enforces it).
  await supabase.from("training_logs").delete().eq("id", logId).eq("user_id", userId);
  revalidatePath("/diario");
  redirect("/diario");
}
