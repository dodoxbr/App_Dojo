"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@dojo/contracts/membership";
import { getCaller } from "@/lib/context";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import type { FormState } from "../../login/actions";

export async function requestMembership(academyId: string): Promise<FormState> {
  if (!idSchema.safeParse(academyId).success) return { error: "Link inválido." };
  const { supabase } = await getCaller();
  const { error } = await supabase.rpc("request_membership", { p_academy_id: academyId });
  if (error) {
    return {
      error: rpcErrorMessage(error, {
        conflict: "Seu pedido anterior foi encerrado. Fale com o gestor da academia.",
      }),
    };
  }
  revalidatePath("/entrar", "layout");
  revalidatePath("/perfil");
  return { message: "Pedido enviado. Aguarde a aprovação do gestor." };
}
