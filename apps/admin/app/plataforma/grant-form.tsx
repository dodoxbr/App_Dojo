"use client";

import { useActionState } from "react";
import { grantCreator } from "./actions";
import type { FormState } from "../login/actions";

export function GrantForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(grantCreator, {});
  return (
    <form action={action}>
      <label>E-mail da pessoa (precisa ter conta) <input name="email" type="email" required /></label>
      <button type="submit" disabled={pending}>{pending ? "Liberando…" : "Liberar para criar academias"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
