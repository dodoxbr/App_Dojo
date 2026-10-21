"use client";

import { useActionState, useState } from "react";
import { skillStatuses, skillStatusLabels } from "@dojo/contracts/curriculum";
import { assessSkill } from "./actions";
import type { FormState } from "../../../login/actions";

type Props = { academyId: string; userId: string; techniqueId: string; current: string };

export function AssessForm({ academyId, userId, techniqueId, current }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => assessSkill(academyId, userId, techniqueId, prev, formData), {});
  // New key whenever a field changes: a double click repeats the same request, a different choice is a new one.
  const [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <form action={action} onChange={() => setKey(crypto.randomUUID())} style={{ display: "inline" }}>
      <input type="hidden" name="idempotencyKey" value={key} />
      <select name="status" defaultValue={current} aria-label="Status do domínio">
        {skillStatuses.map((s) => <option key={s} value={s}>{skillStatusLabels[s]}</option>)}
      </select>{" "}
      <input name="note" placeholder="observação / motivo" maxLength={500} />{" "}
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
      {state.error && <span role="alert"> {state.error}</span>}
      {state.message && <span role="status"> {state.message}</span>}
    </form>
  );
}
