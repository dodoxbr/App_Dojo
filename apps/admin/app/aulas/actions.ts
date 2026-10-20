"use server";

import { revalidatePath } from "next/cache";
import { checkInTokenSchema } from "@dojo/contracts/attendance";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../login/actions";

// Manual and QR check-in share this action; the token (QR) only changes how the request is labelled.
// Either way the attendance stays PENDING until a teacher confirms it.
export async function requestCheckIn(sessionId: string, token: string | null): Promise<FormState> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Aula inválida." };
  if (token !== null && !checkInTokenSchema.safeParse(token).success) {
    return { error: "O QR code é inválido ou expirou. Peça um novo ao professor." };
  }

  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("request_check_in", { p_session_id: sessionId, p_token: token });
  if (error) {
    if (error.code === "22023" && error.message.includes("token")) {
      return { error: "O QR code é inválido ou expirou. Peça um novo ao professor." };
    }
    if (error.code === "22023") return { error: "O check-in só abre 1 hora antes do início e fecha 1 hora depois do fim da aula." };
    if (error.code === "23505") return { error: "Sua presença nesta aula foi revogada. Fale com o professor." };
    return { error: rpcErrorMessage(error) };
  }
  revalidatePath("/aulas");
  return { message: "Pedido enviado. Aguarde a confirmação do professor." };
}
