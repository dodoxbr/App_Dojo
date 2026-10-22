"use client";

import { useActionState, useState } from "react";
import { createTechnique } from "../actions";
import type { FormState } from "../../login/actions";
import { PreservingForm } from "@/components/ui/PreservingForm";

type Scope = { id: string; label: string };

export function CreateTechniqueForm({ scopes }: { scopes: Scope[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTechnique, {});
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <PreservingForm action={action} state={state}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>
        Onde cadastrar{" "}
        <select name="academyId" defaultValue={scopes[0]?.id ?? ""}>
          {scopes.map((s) => <option key={s.id || "global"} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label>Nome <input name="name" minLength={2} maxLength={160} required /></label>
      <label>Categoria <input name="category" minLength={2} maxLength={80} required /></label>
      <label>Nível (opcional) <input name="level" maxLength={40} /></label>
      <label>Tipo (opcional) <input name="type" maxLength={60} placeholder="ex.: Estrangulamento" /></label>
      <label>Posição (opcional) <input name="position" maxLength={60} placeholder="ex.: Montada" /></label>
      <label>Descrição (opcional) <textarea name="description" maxLength={4000} rows={4} /></label>
      <button type="submit" disabled={pending}>{pending ? "Cadastrando…" : "Cadastrar técnica"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </PreservingForm>
  );
}
