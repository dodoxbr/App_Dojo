"use client";

import { useActionState, useState } from "react";
import { createClass, createSession, updateClass } from "./actions";
import type { FormState } from "../login/actions";

type Person = { id: string; name: string };

export function CreateClassForm({ academyId, instructors }: { academyId: string; instructors: Person[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createClass, {});
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <form action={action}>
      <input type="hidden" name="academyId" value={academyId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>Nome da turma <input name="title" minLength={2} maxLength={120} required /></label>
      <label>
        Instrutor responsável{" "}
        <select name="instructorUserId" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          {instructors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar turma"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}

type EditProps = { classId: string; title: string; instructorUserId: string; isActive: boolean; instructors: Person[] };

export function EditClassForm({ classId, title, instructorUserId, isActive, instructors }: EditProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateClass.bind(null, classId), {});
  return (
    <form action={action}>
      <label>Nome da turma <input name="title" defaultValue={title} minLength={2} maxLength={120} required /></label>
      <label>
        Instrutor responsável{" "}
        <select name="instructorUserId" defaultValue={instructorUserId}>
          {instructors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label><input type="checkbox" name="isActive" defaultChecked={isActive} /> Turma ativa</label>
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar turma"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}

export function CreateSessionForm({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSession.bind(null, classId), {});
  // The key changes whenever a field changes: a double click repeats the same request (same key, no duplicate),
  // while a different date/time is always a new request.
  const [idempotencyKey, setKey] = useState(() => crypto.randomUUID());
  return (
    <form action={action} onChange={() => setKey(crypto.randomUUID())}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label>Data <input name="date" type="date" required /></label>
      <label>Início <input name="start" type="time" defaultValue="19:00" required /></label>
      <label>Fim <input name="end" type="time" defaultValue="20:00" required /></label>
      <button type="submit" disabled={pending}>{pending ? "Agendando…" : "Agendar aula"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
