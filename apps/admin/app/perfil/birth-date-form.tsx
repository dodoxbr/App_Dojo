"use client";

import { useActionState } from "react";
import { declareBirthDate } from "./actions";
import type { FormState } from "../login/actions";

// One-time declaration for accounts created before the birth date was asked (it cannot be changed afterwards).
export function BirthDateForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(declareBirthDate, {});
  return (
    <form action={action}>
      <p>
        Para entrar em uma academia precisamos saber se você é maior de idade. Informe a sua data de nascimento: ela só pode ser
        declarada uma vez e não é visível para a academia (ela vê apenas se você é adulto).
      </p>
      <label>Data de nascimento <input name="birthDate" type="date" min="1900-01-01" required /></label>
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Informar"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
