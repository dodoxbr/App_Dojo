"use client";

import { useActionState } from "react";
import { grantCreator } from "./actions";
import type { FormState } from "../login/actions";
import { PreservingForm } from "@/components/ui/PreservingForm";

export function GrantForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(grantCreator, {});
  return (
    <PreservingForm action={action} state={state} resetOnSuccess>
      <label>E-mail da pessoa (precisa ter conta) <input name="email" type="email" required /></label>
      <button type="submit" disabled={pending}>{pending ? "Liberando…" : "Liberar para criar academias"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </PreservingForm>
  );
}
