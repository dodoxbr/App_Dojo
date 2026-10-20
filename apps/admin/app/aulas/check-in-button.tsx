"use client";

import { useActionState } from "react";
import { requestCheckIn } from "./actions";
import type { FormState } from "../login/actions";

export function CheckInButton({ sessionId, token = null }: { sessionId: string; token?: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestCheckIn.bind(null, sessionId, token), {});
  return (
    <form action={action} style={{ display: "inline" }}>
      <button type="submit" disabled={pending || !!state.message}>
        {pending ? "Enviando…" : state.message ? "Pedido enviado" : "Fazer check-in"}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
