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
      <label>Razão social da empresa <input name="legalName" minLength={2} maxLength={200} required /></label>
      <label>CNPJ <input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" required /></label>
      <p><small>A razão social e o CNPJ aparecem nos termos de uso e na política de privacidade da sua academia. Você pode corrigi-los depois.</small></p>
      <button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar academia"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
