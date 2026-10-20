"use client";

import { useActionState, useState } from "react";
import { catalogLevels } from "@dojo/contracts/curriculum";
import { createCurriculum, updateCurriculum } from "./actions";
import type { FormState } from "../../../login/actions";

function LevelSelect({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <label>
      Nível{" "}
      <select name="level" defaultValue={defaultValue}>
        <option value="">Sem nível</option>
        {catalogLevels.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
    </label>
  );
}

export function CreateCurriculumForm({ academyId }: { academyId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCurriculum, {});
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <form action={action}>
      <input type="hidden" name="academyId" value={academyId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>Nome do currículo <input name="title" minLength={2} maxLength={120} required placeholder="ex.: Faixa branca" /></label>
      <LevelSelect />
      <button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar currículo"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}

export function EditCurriculumForm(props: { curriculumId: string; title: string; level: string; isActive: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCurriculum.bind(null, props.curriculumId), {});
  return (
    <form action={action}>
      <label>Nome do currículo <input name="title" defaultValue={props.title} minLength={2} maxLength={120} required /></label>
      <LevelSelect defaultValue={props.level} />
      <label><input type="checkbox" name="isActive" defaultChecked={props.isActive} /> Currículo ativo</label>
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
