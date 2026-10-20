"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addMemberSchema, decideMembershipSchema, endMembershipSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage, redirectErrorCodes } from "@/lib/rpc-errors";
import type { FormState } from "../../../login/actions";

function back(academyId: string, error?: { code?: string }): never {
  const code = error?.code && (redirectErrorCodes as readonly string[]).includes(error.code) ? error.code : error ? "other" : "";
  redirect(`/academia/${academyId}/membros${code ? `?erro=${code}` : ""}`);
}

export async function decide(academyId: string, formData: FormData) {
  const parsed = decideMembershipSchema.safeParse({
    membershipId: formData.get("membershipId"),
    decision: formData.get("decision"),
    reason: formData.get("reason") ?? undefined,
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) back(academyId, { code: "22023" });

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("decide_membership", {
    p_membership_id: parsed.data.membershipId,
    p_decision: parsed.data.decision,
    p_reason: parsed.data.reason ?? null,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  revalidatePath(`/academia/${academyId}/membros`);
  back(academyId, error ?? undefined);
}

export async function endMembership(academyId: string, formData: FormData) {
  const parsed = endMembershipSchema.safeParse({
    membershipId: formData.get("membershipId"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) back(academyId, { code: "22023" });

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("end_membership", {
    p_membership_id: parsed.data.membershipId,
    p_reason: parsed.data.reason ?? null,
  });
  revalidatePath(`/academia/${academyId}/membros`);
  back(academyId, error ?? undefined);
}

export async function addMember(academyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = addMemberSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: "Informe um e-mail válido e o papel (aluno ou instrutor)." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("add_member", {
    p_academy_id: academyId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) {
    return {
      error: rpcErrorMessage(error, { conflict: "Esse vínculo não pode ser alterado (por exemplo, é o do gestor)." }),
    };
  }
  revalidatePath(`/academia/${academyId}/membros`);
  return { message: "Pessoa cadastrada na academia." };
}
