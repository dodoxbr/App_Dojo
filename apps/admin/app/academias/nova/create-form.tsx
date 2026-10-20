"use client";

import { useActionState, useState } from "react";
import { createAcademy } from "./actions";
import type { FormState } from "../../login/actions";

export function CreateAcademyForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createAcademy, {});
  // One key per form instance: resubmitting the same form never creates a second academy.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <form action={action}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>Nome da academia <input name="name" minLength={2} maxLength={160} required /></label>
      <label>Endereço (slug, usado no link dos alunos) <input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
      <button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar academia"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
