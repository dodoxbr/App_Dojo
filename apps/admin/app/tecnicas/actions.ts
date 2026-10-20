"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { aliasSchema, createTechniqueSchema, techniqueInputSchema } from "@dojo/contracts/technique";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

const CONFLICT = "Já existe uma técnica com esse nome e categoria neste escopo.";

export async function createTechnique(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createTechniqueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe nome (2 a 160) e categoria (2 a 80) válidos." };

  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("create_technique", {
    p_academy_id: parsed.data.academyId ?? null,
    p_name: parsed.data.name,
    p_category: parsed.data.category,
    p_level: parsed.data.level ?? null,
    p_description: parsed.data.description ?? null,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_type: parsed.data.type ?? null,
    p_position: parsed.data.position ?? null,
  });
  if (error || !data) return { error: rpcErrorMessage(error ?? {}, { conflict: CONFLICT }) };
  redirect(`/tecnicas/${data}`);
}

export async function updateTechnique(techniqueId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = techniqueInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !idSchema.safeParse(techniqueId).success) return { error: "Revise os campos." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("update_technique", {
    p_technique_id: techniqueId,
    p_name: parsed.data.name,
    p_category: parsed.data.category,
    p_level: parsed.data.level ?? null,
    p_description: parsed.data.description ?? null,
    p_type: parsed.data.type ?? null,
    p_position: parsed.data.position ?? null,
  });
  if (error) return { error: rpcErrorMessage(error, { conflict: CONFLICT }) };
  revalidatePath(`/tecnicas/${techniqueId}`);
  return { message: "Técnica salva. A revisão anterior foi invalidada." };
}

export async function reviewTechnique(techniqueId: string): Promise<void> {
  if (!idSchema.safeParse(techniqueId).success) return;
  const { supabase } = await getCaller();
  await supabase.rpc("review_technique", { p_technique_id: techniqueId });
  revalidatePath(`/tecnicas/${techniqueId}`);
}

export async function addAlias(techniqueId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = aliasSchema.safeParse(formData.get("alias"));
  if (!parsed.success || !idSchema.safeParse(techniqueId).success) return { error: "O sinônimo deve ter de 2 a 120 caracteres." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("add_technique_alias", { p_technique_id: techniqueId, p_alias: parsed.data });
  if (error) return { error: rpcErrorMessage(error, { conflict: "Esse sinônimo já existe nesta técnica." }) };
  revalidatePath(`/tecnicas/${techniqueId}`);
  return { message: "Sinônimo adicionado." };
}

export async function removeAlias(techniqueId: string, formData: FormData): Promise<void> {
  const aliasId = formData.get("aliasId");
  if (!idSchema.safeParse(aliasId).success) return;
  const { supabase } = await getCaller();
  await supabase.rpc("remove_technique_alias", { p_alias_id: aliasId });
  revalidatePath(`/tecnicas/${techniqueId}`);
}
