"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { PARQ_QUESTION_COUNT, PARQ_VERSION, parqSubmitSchema, signatureBytes } from "@dojo/contracts/parq";
import { idSchema } from "@dojo/contracts/membership";
import { healthResponsibilityText } from "@dojo/contracts/terms";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

// A pessoa (ou o responsável, pelo menor) responde o PAR-Q, lê o termo de responsabilidade de saúde e assina desenhando.
// A hora é a do banco; aqui o servidor junta as evidências: hash do texto do termo, IP e navegador. Dado de saúde: o banco só deixa
// gravar quem pode e registra só o resultado na auditoria.
export async function submitParq(userId: string, revalidate: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!idSchema.safeParse(userId).success) return { error: "Pessoa inválida." };
  const answers: (boolean | undefined)[] = [];
  for (let i = 0; i < PARQ_QUESTION_COUNT; i++) {
    const v = formData.get(`q${i}`);
    answers.push(v === "sim" ? true : v === "nao" ? false : undefined);
  }
  if (answers.some((a) => a === undefined)) return { error: "Responda as 7 perguntas (sim ou não)." };
  const parsed = parqSubmitSchema.safeParse({ answers, notes: formData.get("notes") ?? undefined, signaturePng: String(formData.get("signaturePng") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o formulário." };
  if (formData.get("agree") !== "on") return { error: "Marque que você leu e concorda com o termo de responsabilidade de saúde." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  const userAgent = (h.get("user-agent") ?? "").slice(0, 300);
  const termHash = createHash("sha256").update(healthResponsibilityText()).digest("hex");
  const png = Buffer.from(signatureBytes(parsed.data.signaturePng));

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("submit_parq", {
    p_user_id: userId,
    p_answers: parsed.data.answers,
    p_notes: parsed.data.notes ?? null,
    p_signature_png: `\\x${png.toString("hex")}`, // PostgREST bytea input
    p_term_hash: termHash,
    p_client_ip: ip || null,
    p_user_agent: userAgent || null,
    p_version: PARQ_VERSION,
  });
  if (error) return { error: rpcErrorMessage(error) };
  revalidatePath(revalidate);
  revalidatePath("/perfil");
  revalidatePath("/inicio");
  return { message: parsed.data.answers.some(Boolean) ? "flag" : "ok" };
}
