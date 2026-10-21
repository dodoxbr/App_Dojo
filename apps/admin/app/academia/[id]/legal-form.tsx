"use client";

import { useActionState } from "react";
import { updateLegal } from "./actions";
import type { FormState } from "../../login/actions";

export function LegalForm({ academyId, legalName, cnpj }: { academyId: string; legalName: string; cnpj: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => updateLegal(academyId, prev, formData), {});
  return (
    <form action={action}>
      <label>Razão social <input name="legalName" defaultValue={legalName} minLength={2} maxLength={200} required /></label>
      <label>CNPJ <input name="cnpj" inputMode="numeric" defaultValue={cnpj} placeholder="00.000.000/0000-00" required /></label>
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar dados da empresa"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
