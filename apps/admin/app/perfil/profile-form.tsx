"use client";

import { useActionState } from "react";
import { updateDisplayName } from "./actions";
import type { FormState } from "../login/actions";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateDisplayName, {});
  return (
    <form action={action}>
      <label>Nome <input name="displayName" defaultValue={displayName} minLength={2} maxLength={120} required /></label>
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
