"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  assessManualSchema,
  correctPromotionSchema,
  createRuleSchema,
  grantPromotionSchema,
  registerRankSchema,
  toDbCriteria,
} from "@dojo/contracts/graduation";
import { milestoneSettingInputSchema } from "@dojo/contracts/milestone";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../../../login/actions";

// Creates a NEW version of the rule for (belt, degree). Previous versions stay as they were.
export async function createRule(academyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let criteria: unknown;
  try {
    criteria = JSON.parse(String(formData.get("criteria") ?? "[]"));
  } catch {
    return { error: "Revise os critérios da regra." };
  }
  const parsed = createRuleSchema.safeParse({
    academyId,
    beltCode: formData.get("beltCode"),
    degree: Number(formData.get("degree")),
    title: formData.get("title") ?? undefined,
    effectiveFrom: formData.get("effectiveFrom"),
    criteria,
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return { error: "Revise a faixa, o grau, a data e os critérios (de 1 a 20, com nomes diferentes e todos os valores preenchidos)." };
  }

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("create_promotion_rule", {
    p_academy_id: academyId,
    p_belt_code: parsed.data.beltCode,
    p_degree: parsed.data.degree,
    p_title: parsed.data.title ?? null,
    p_effective_from: parsed.data.effectiveFrom,
    p_criteria: toDbCriteria(parsed.data.criteria),
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/academia/${academyId}/graduacao`);
  redirect(`/academia/${academyId}/graduacao`);
}

export async function registerRank(academyId: string, userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerRankSchema.safeParse({
    academyId,
    userId,
    beltCode: formData.get("beltCode"),
    degree: Number(formData.get("degree")),
    effectiveDate: formData.get("effectiveDate"),
    reason: formData.get("reason") ?? undefined,
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { error: "Informe a faixa, o grau (0 a 20) e a data (não pode ser futura)." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("register_initial_rank", {
    p_academy_id: academyId,
    p_user_id: userId,
    p_belt_code: parsed.data.beltCode,
    p_degree: parsed.data.degree,
    p_effective_date: parsed.data.effectiveDate,
    p_reason: parsed.data.reason ?? null,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    return { error: rpcErrorMessage(error, { conflict: "Esta pessoa já tem graduação registrada. Mudanças serão feitas por promoção." }) };
  }
  revalidatePath(`/academia/${academyId}/graduacao`, "layout");
  return { message: "Graduação registrada." };
}

export async function assessManual(academyId: string, userId: string, label: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = assessManualSchema.safeParse({
    academyId,
    userId,
    label,
    met: formData.get("met") === "true",
    note: formData.get("note") ?? undefined,
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { error: "Revise a observação (até 500 caracteres)." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("assess_manual_criterion", {
    p_academy_id: academyId,
    p_user_id: userId,
    p_label: parsed.data.label,
    p_met: parsed.data.met,
    p_note: parsed.data.note ?? null,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    if (error.code === "42501" && error.message.includes("self")) return { error: "Ninguém avalia o próprio critério." };
    return { error: rpcErrorMessage(error) };
  }
  revalidatePath(`/academia/${academyId}/graduacao/alunos/${userId}`);
  return { message: "Avaliação salva." };
}

// Only the academy manager decides a promotion. The system recommends; it never promotes by itself.
export async function grantPromotion(academyId: string, userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = grantPromotionSchema.safeParse({
    academyId,
    userId,
    beltCode: formData.get("beltCode"),
    degree: Number(formData.get("degree")),
    effectiveDate: formData.get("effectiveDate"),
    reason: formData.get("reason"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { error: "Informe a faixa, o grau (0 a 20), a data (não pode ser futura) e a justificativa (mínimo 3 caracteres)." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("grant_promotion", {
    p_academy_id: academyId,
    p_user_id: userId,
    p_belt_code: parsed.data.beltCode,
    p_degree: parsed.data.degree,
    p_effective_date: parsed.data.effectiveDate,
    p_reason: parsed.data.reason,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return { error: promotionError(error) };
  revalidatePath(`/academia/${academyId}/graduacao`, "layout");
  return { message: "Graduação concedida e registrada no histórico." };
}

export async function correctPromotion(academyId: string, promotionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = correctPromotionSchema.safeParse({
    promotionId,
    beltCode: formData.get("beltCode"),
    degree: Number(formData.get("degree")),
    effectiveDate: formData.get("effectiveDate"),
    reason: formData.get("reason"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { error: "Informe a faixa, o grau (0 a 20), a data (não pode ser futura) e o motivo da retificação." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("correct_promotion", {
    p_promotion_id: promotionId,
    p_belt_code: parsed.data.beltCode,
    p_degree: parsed.data.degree,
    p_effective_date: parsed.data.effectiveDate,
    p_reason: parsed.data.reason,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return { error: promotionError(error) };
  revalidatePath(`/academia/${academyId}/graduacao`, "layout");
  return { message: "Retificação registrada. O histórico anterior foi mantido." };
}

function promotionError(error: { code?: string; message: string }): string {
  const m = error.message;
  if (error.code === "42501" && m.includes("self")) return "Ninguém altera a própria graduação.";
  if (error.code === "22023") {
    if (m.includes("no current rank")) return "Registre primeiro a graduação atual deste aluno.";
    if (m.includes("same rank")) return "O destino é igual à graduação atual.";
    if (m.includes("before current rank")) return "A data não pode ser anterior à graduação atual.";
    if (m.includes("no change")) return "Nada foi alterado em relação ao registro.";
    if (m.includes("reason")) return "Informe a justificativa (mínimo 3 caracteres).";
  }
  if (error.code === "23505") return "Este registro já foi retificado. Retifique o registro mais recente.";
  return rpcErrorMessage(error);
}

// Each teacher (or the manager) decides how many trainings trigger the notice for the students they follow, or turns it off.
export async function saveMilestoneSetting(academyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = milestoneSettingInputSchema.safeParse({ threshold: formData.get("threshold"), enabled: formData.get("enabled") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o número de treinos." };
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("set_my_milestone_setting", { p_academy_id: academyId, p_threshold: parsed.data.threshold, p_enabled: parsed.data.enabled });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(`/academia/${academyId}/graduacao/alunos`);
  revalidatePath("/perfil");
  return { message: parsed.data.enabled ? `Combinado: o aviso aparece aos ${parsed.data.threshold} treinos.` : "Aviso desligado para os seus alunos." };
}
