"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createChargeSchema, markPaidSchema, monthParamSchema, monthStart, reasonSchema, setPlanSchema } from "@dojo/contracts/finance";
import { idSchema } from "@dojo/contracts/membership";
import { financeErrorKey } from "@/lib/finance-ui";
import { getCaller } from "@/lib/context";

// Only paths inside this academy's finance area are accepted as the place to return to.
function backTo(academyId: string, next: unknown, extra: Record<string, string> = {}): never {
  const base = `/academia/${academyId}/financeiro`;
  const safe = typeof next === "string" && next.startsWith(base) && !next.includes("//") && !next.includes("\\") ? next : base;
  const url = new URL(safe, "http://local");
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  revalidatePath(base, "layout");
  redirect(`${url.pathname}${url.search}`);
}

const fail = (academyId: string, next: unknown, key: string): never => backTo(academyId, next, { erro: key });

export async function setPlan(academyId: string, formData: FormData): Promise<void> {
  const next = `/academia/${academyId}/financeiro/planos`;
  if (!idSchema.safeParse(academyId).success) return;
  const parsed = setPlanSchema.safeParse({
    userId: formData.get("userId"),
    amount: formData.get("amount"),
    dueDay: formData.get("dueDay"),
    startsOn: formData.get("startsOn"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(academyId, next, field === "dueDay" ? "due_day" : "amount");
  }
  const { supabase } = await getCaller();
  const p = parsed.data;
  const { error } = await supabase.rpc("set_member_plan", {
    p_academy_id: academyId, p_user_id: p.userId, p_amount_cents: p.amount, p_due_day: p.dueDay, p_starts_on: p.startsOn, p_active: p.active,
  });
  if (error) return fail(academyId, next, financeErrorKey(error));
  return backTo(academyId, next, { ok: "1" });
}

export async function generateMonth(academyId: string, formData: FormData): Promise<void> {
  const month = formData.get("month");
  const key = formData.get("idempotencyKey");
  if (!monthParamSchema.safeParse(month).success || !idSchema.safeParse(key).success) return fail(academyId, null, "month");
  const next = `/academia/${academyId}/financeiro?mes=${month as string}`;
  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("generate_monthly_charges", {
    p_academy_id: academyId, p_month: monthStart(month as string), p_idempotency_key: key,
  });
  if (error) return fail(academyId, next, financeErrorKey(error));
  return backTo(academyId, next, { gerou: String(data ?? 0) });
}

export async function createCharge(academyId: string, formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  const next = `/academia/${academyId}/financeiro/alunos/${typeof userId === "string" ? userId : ""}`;
  const parsed = createChargeSchema.safeParse({
    userId, description: formData.get("description"), amount: formData.get("amount"), dueDate: formData.get("dueDate"), idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(academyId, next, field === "description" ? "description" : field === "dueDate" ? "due_date" : "amount");
  }
  const { supabase } = await getCaller();
  const c = parsed.data;
  const { error } = await supabase.rpc("create_charge", {
    p_academy_id: academyId, p_user_id: c.userId, p_description: c.description, p_amount_cents: c.amount, p_due_date: c.dueDate, p_idempotency_key: c.idempotencyKey,
  });
  if (error) return fail(academyId, next, financeErrorKey(error));
  return backTo(academyId, next, { ok: "1" });
}

export async function markPaid(academyId: string, formData: FormData): Promise<void> {
  const next = formData.get("next");
  const parsed = markPaidSchema.safeParse({
    chargeId: formData.get("chargeId"), method: formData.get("method"), paidOn: formData.get("paidOn"), note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return fail(academyId, next, parsed.error.issues[0]?.path[0] === "method" ? "method" : "paid_on");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("mark_charge_paid", {
    p_charge_id: parsed.data.chargeId, p_method: parsed.data.method, p_paid_on: parsed.data.paidOn, p_note: parsed.data.note ?? null,
  });
  if (error) return fail(academyId, next, financeErrorKey(error));
  return backTo(academyId, next);
}

async function transition(rpc: "cancel_charge" | "waive_charge" | "reopen_charge", academyId: string, formData: FormData): Promise<void> {
  const next = formData.get("next");
  const parsed = reasonSchema.safeParse({ chargeId: formData.get("chargeId"), reason: formData.get("reason") });
  if (!parsed.success) return fail(academyId, next, "reason");
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc(rpc, { p_charge_id: parsed.data.chargeId, p_reason: parsed.data.reason });
  if (error) return fail(academyId, next, financeErrorKey(error));
  return backTo(academyId, next);
}

export const cancelCharge = async (academyId: string, formData: FormData) => transition("cancel_charge", academyId, formData);
export const waiveCharge = async (academyId: string, formData: FormData) => transition("waive_charge", academyId, formData);
export const reopenCharge = async (academyId: string, formData: FormData) => transition("reopen_charge", academyId, formData);
