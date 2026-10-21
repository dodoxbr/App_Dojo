"use client";

import { useActionState } from "react";
import { selfSkillStatuses, skillStatusLabels } from "@dojo/contracts/curriculum";
import { declareSkill } from "./actions";
import type { FormState } from "../login/actions";

export function SkillSelect({ academyId, techniqueId, current }: { academyId: string; techniqueId: string; current: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => declareSkill(academyId, techniqueId, prev, formData), {});
  return (
    <form action={action} style={{ display: "inline" }}>
      <select name="status" defaultValue={current} aria-label="Meu progresso nesta técnica">
        {selfSkillStatuses.map((s) => <option key={s} value={s}>{skillStatusLabels[s]}</option>)}
      </select>{" "}
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
      {state.error && <span role="alert"> {state.error}</span>}
      {state.message && <span role="status"> {state.message}</span>}
    </form>
  );
}
