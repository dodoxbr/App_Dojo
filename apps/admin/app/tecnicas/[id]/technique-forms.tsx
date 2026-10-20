"use client";

import { useActionState } from "react";
import { addAlias, updateTechnique } from "../actions";
import type { FormState } from "../../login/actions";

type Props = {
  techniqueId: string; name: string; category: string; level: string; description: string;
  type: string; position: string;
};

export function EditForm({ techniqueId, name, category, level, description, type, position }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateTechnique.bind(null, techniqueId), {});
  return (
    <form action={action}>
      <label>Nome <input name="name" defaultValue={name} minLength={2} maxLength={160} required /></label>
      <label>Categoria <input name="category" defaultValue={category} minLength={2} maxLength={80} required /></label>
      <label>Nível <input name="level" defaultValue={level} maxLength={40} /></label>
      <label>Tipo <input name="type" defaultValue={type} maxLength={60} placeholder="ex.: Estrangulamento" /></label>
      <label>Posição <input name="position" defaultValue={position} maxLength={60} placeholder="ex.: Montada" /></label>
      <label>Descrição <textarea name="description" defaultValue={description} maxLength={4000} rows={4} /></label>
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}

export function AliasForm({ techniqueId }: { techniqueId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addAlias.bind(null, techniqueId), {});
  return (
    <form action={action}>
      <label>Novo sinônimo <input name="alias" minLength={2} maxLength={120} required /></label>
      <button type="submit" disabled={pending}>{pending ? "Adicionando…" : "Adicionar"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
