"use server";

import { redirect } from "next/navigation";
import { createAcademySchema } from "@dojo/contracts/academy";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../../login/actions";

export async function createAcademy(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createAcademySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe um nome (2 a 160 caracteres) e um endereço com letras minúsculas, números e hífens." };

  const { supabase } = await getCaller();
  const { data, error } = await supabase.rpc("create_academy", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error || !data) return { error: rpcErrorMessage(error ?? {}) };
  redirect(`/academia/${data}`);
}
