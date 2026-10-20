"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCurriculumSchema, levelShortcutSchema, updateCurriculumSchema } from "@dojo/contracts/curriculum";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../../../login/actions";

const TITLE_CONFLICT = "Já existe um currículo ativo com esse nome nesta academia.";

export async function createCurriculum(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createCurriculumSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe o nome do currículo (2 a 120 caracteres)." };

  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("create_curriculum", {
    p_academy_id: parsed.data.academyId,
    p_title: parsed.data.title,
    p_level: parsed.data.level ?? null,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error || !data) return { error: rpcErrorMessage(error ?? {}, { conflict: TITLE_CONFLICT }) };
  redirect(`/academia/${parsed.data.academyId}/curriculos/${data}`);
}

export async function updateCurriculum(curriculumId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = updateCurriculumSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !idSchema.safeParse(curriculumId).success) return { error: "Revise o nome e o nível." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("update_curriculum", {
    p_curriculum_id: curriculumId,
    p_title: parsed.data.title,
    p_level: parsed.data.level ?? null,
    p_is_active: parsed.data.isActive,
  });
  if (error) return { error: rpcErrorMessage(error, { conflict: TITLE_CONFLICT }) };
  revalidatePath("/academia", "layout");
  return { message: "Currículo salvo." };
}

function back(academyId: string, curriculumId: string, error?: string): never {
  redirect(`/academia/${academyId}/curriculos/${curriculumId}${error ? `?erro=${error}` : ""}`);
}

export async function addItem(academyId: string, curriculumId: string, formData: FormData): Promise<void> {
  const techniqueId = formData.get("techniqueId");
  if (!idSchema.safeParse(techniqueId).success) back(academyId, curriculumId, "22023");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("add_curriculum_item", {
    p_curriculum_id: curriculumId,
    p_technique_id: techniqueId,
    p_required: formData.get("required") === "on",
  });
  revalidatePath(`/academia/${academyId}/curriculos/${curriculumId}`);
  back(academyId, curriculumId, error?.code);
}

export async function addFromLevel(academyId: string, curriculumId: string, formData: FormData): Promise<void> {
  const level = levelShortcutSchema.safeParse(formData.get("level"));
  if (!level.success) back(academyId, curriculumId, "22023");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("add_curriculum_items_from_level", {
    p_curriculum_id: curriculumId,
    p_level: level.data,
  });
  revalidatePath(`/academia/${academyId}/curriculos/${curriculumId}`);
  back(academyId, curriculumId, error?.code);
}

export async function removeItem(academyId: string, curriculumId: string, formData: FormData): Promise<void> {
  const itemId = formData.get("itemId");
  if (!idSchema.safeParse(itemId).success) back(academyId, curriculumId, "22023");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("remove_curriculum_item", { p_item_id: itemId });
  revalidatePath(`/academia/${academyId}/curriculos/${curriculumId}`);
  back(academyId, curriculumId, error?.code);
}

export async function toggleRequired(academyId: string, curriculumId: string, formData: FormData): Promise<void> {
  const itemId = formData.get("itemId");
  if (!idSchema.safeParse(itemId).success) back(academyId, curriculumId, "22023");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("set_curriculum_item_required", {
    p_item_id: itemId,
    p_required: formData.get("required") === "true",
  });
  revalidatePath(`/academia/${academyId}/curriculos/${curriculumId}`);
  back(academyId, curriculumId, error?.code);
}
