"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  cancelSessionSchema,
  createClassSchema,
  createSessionSchema,
  updateClassSchema,
} from "@dojo/contracts/classes";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

const CLASS_CONFLICT = "Já existe uma turma ativa com esse nome nesta academia.";
const SESSION_CONFLICT = "Já existe uma aula desta turma nesse mesmo horário.";

export async function createClass(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createClassSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe o nome da turma (2 a 120 caracteres) e o instrutor responsável." };

  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("create_class", {
    p_academy_id: parsed.data.academyId,
    p_title: parsed.data.title,
    p_instructor_user_id: parsed.data.instructorUserId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error || !data) return { error: rpcErrorMessage(error ?? {}, { conflict: CLASS_CONFLICT }) };
  redirect(`/turmas/${data}`);
}

export async function updateClass(classId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = updateClassSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !idSchema.safeParse(classId).success) return { error: "Revise o nome e o instrutor." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("update_class", {
    p_class_id: classId,
    p_title: parsed.data.title,
    p_instructor_user_id: parsed.data.instructorUserId,
    p_is_active: parsed.data.isActive,
  });
  if (error) return { error: rpcErrorMessage(error, { conflict: CLASS_CONFLICT }) };
  revalidatePath(`/turmas/${classId}`);
  return { message: "Turma salva." };
}

export async function createSession(classId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !idSchema.safeParse(classId).success) {
    return { error: "Informe uma data e horários válidos (o fim deve ser depois do início)." };
  }

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("create_session", {
    p_class_id: classId,
    p_date: parsed.data.date,
    p_start: parsed.data.start,
    p_end: parsed.data.end,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return { error: rpcErrorMessage(error, { conflict: SESSION_CONFLICT }) };
  revalidatePath(`/turmas/${classId}`);
  revalidatePath("/aulas");
  return { message: "Aula agendada." };
}

export async function cancelSession(classId: string, formData: FormData): Promise<void> {
  const parsed = cancelSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) redirect(`/turmas/${classId}?erro=22023`);

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("cancel_session", {
    p_session_id: parsed.data.sessionId,
    p_reason: parsed.data.reason ?? null,
  });
  revalidatePath(`/turmas/${classId}`);
  revalidatePath("/aulas");
  redirect(`/turmas/${classId}${error ? "?erro=42501" : ""}`);
}
