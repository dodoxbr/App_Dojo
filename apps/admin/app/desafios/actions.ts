"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addEntrySchema, cancelChallengeSchema, createChallengeSchema } from "@dojo/contracts/challenges";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

function challengeError(error: { code?: string; message: string }): string {
  const m = error.message;
  if (error.code === "22023") {
    if (m.includes("adult required")) return "Só maiores de 18 anos participam de desafios.";
    if (m.includes("too many open")) return "Você já tem 3 desafios em aberto nesta academia. Espere um terminar ou cancele um.";
    if (m.includes("challenge closed")) return "Este desafio já foi encerrado ou cancelado.";
    if (m.includes("not active")) return "O desafio ainda não começou: ele ativa quando atingir o mínimo de participantes.";
    if (m.includes("daily cap")) return "Você já atingiu o limite diário deste desafio para esse dia.";
    if (m.includes("daily limit")) return "Limite de 20 registros por dia atingido.";
    if (m.includes("when")) return "Informe um dia dentro do período do desafio e que não seja futuro.";
    if (m.includes("units")) return "Informe uma quantidade válida (de 1 a 10.000).";
    if (m.includes("min_participants")) return "O mínimo de participantes deve ficar entre 3 e 50.";
    if (m.includes("dates")) return "As datas precisam começar hoje ou depois, e durar no máximo 366 dias.";
    if (m.includes("technique")) return "Escolha a técnica apenas em desafios de golpe (e uma técnica disponível para a academia).";
    if (m.includes("points")) return "Os pontos por unidade devem ficar entre 1 e 1000.";
    if (m.includes("automatic")) return "Desafios de presença pontuam sozinhos; não há registro manual.";
  }
  return rpcErrorMessage(error);
}

export async function createChallenge(_prev: FormState, formData: FormData): Promise<FormState> {
  const num = (k: string) => (formData.get(k) ? Number(formData.get(k)) : undefined);
  const parsed = createChallengeSchema.safeParse({
    academyId: formData.get("academyId"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    metric: formData.get("metric"),
    pointsPerUnit: num("pointsPerUnit"),
    techniqueId: formData.get("techniqueId") ?? undefined,
    maxUnitsPerDay: num("maxUnitsPerDay"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    minParticipants: num("minParticipants"),
    join: formData.get("join") === "on",
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revise os campos do desafio (pontos, datas, mínimo de 3 a 50 participantes)." };
  }

  const { supabase } = await getCaller();
  const c = parsed.data;
  const { data, error } = await supabase.rpc("create_challenge", {
    p_academy_id: c.academyId,
    p_title: c.title,
    p_description: c.description ?? null,
    p_metric: c.metric,
    p_points_per_unit: c.pointsPerUnit,
    p_technique_id: c.techniqueId ?? null,
    p_max_units_per_day: c.maxUnitsPerDay ?? null,
    p_starts_on: c.startsOn,
    p_ends_on: c.endsOn,
    p_min_participants: c.minParticipants,
    p_join: c.join,
    p_idempotency_key: c.idempotencyKey,
  });
  if (error || !data) return { error: challengeError(error ?? { message: "" }) };
  revalidatePath("/desafios");
  redirect(`/desafios/${data}`);
}

export async function joinChallenge(challengeId: string): Promise<void> {
  if (!idSchema.safeParse(challengeId).success) return;
  const { supabase } = await getCaller();
  await supabase.rpc("join_challenge", { p_challenge_id: challengeId });
  revalidatePath("/desafios");
  revalidatePath(`/desafios/${challengeId}`);
}

export async function leaveChallenge(challengeId: string): Promise<void> {
  if (!idSchema.safeParse(challengeId).success) return;
  const { supabase } = await getCaller();
  await supabase.rpc("leave_challenge", { p_challenge_id: challengeId });
  revalidatePath("/desafios");
  revalidatePath(`/desafios/${challengeId}`);
}

// The person tells the day and the time they trained; it counts right away.
export async function addEntry(challengeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = addEntrySchema.safeParse({
    challengeId,
    date: formData.get("date"),
    time: formData.get("time"),
    units: formData.get("units") ? Number(formData.get("units")) : undefined,
    note: formData.get("note") ?? undefined,
    clientKey: formData.get("clientKey"),
  });
  if (!parsed.success) return { error: "Informe o dia e a hora (HH:MM) do treino." };

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("add_challenge_entry", {
    p_challenge_id: challengeId,
    p_local_date: parsed.data.date,
    p_local_time: parsed.data.time,
    p_units: parsed.data.units ?? null,
    p_note: parsed.data.note ?? null,
    p_client_key: parsed.data.clientKey,
  });
  if (error) return { error: challengeError(error) };
  revalidatePath(`/desafios/${challengeId}`);
  return { message: "Registro salvo. Ele já conta pontos." };
}

export async function voidEntry(challengeId: string, formData: FormData): Promise<void> {
  const entryId = formData.get("entryId");
  if (!idSchema.safeParse(entryId).success) return;
  const { supabase } = await getCaller();
  await supabase.rpc("void_challenge_entry", { p_entry_id: entryId });
  revalidatePath(`/desafios/${challengeId}`);
}

export async function cancelChallenge(challengeId: string, formData: FormData): Promise<void> {
  const parsed = cancelChallengeSchema.safeParse({ challengeId, reason: formData.get("reason") });
  if (!parsed.success) redirect(`/desafios/${challengeId}?erro=22023`);
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("cancel_challenge", { p_challenge_id: challengeId, p_reason: parsed.data.reason });
  revalidatePath("/desafios");
  redirect(`/desafios/${challengeId}${error ? "?erro=42501" : ""}`);
}
