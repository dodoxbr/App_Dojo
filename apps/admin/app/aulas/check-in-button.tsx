"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { requestCheckIn } from "./actions";
import type { FormState } from "../login/actions";

export function CheckInButton({ sessionId, token = null }: { sessionId: string; token?: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(() => requestCheckIn(sessionId, token), {});
  return (
    <form action={action} style={{ display: "grid", gap: 8 }}>
      <Button type="submit" loading={pending} disabled={!!state.message}>
        {pending ? "Enviando…" : state.message ? "Pedido enviado" : "Fazer check-in"}
      </Button>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
    </form>
  );
}
