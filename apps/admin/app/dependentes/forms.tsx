"use client";

import { useActionState, useState } from "react";
import { acceptInvite, createDependent, createInvite, requestForDependent } from "./actions";
import type { FormState } from "../login/actions";

function Status({ state }: { state: FormState }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.message) return <p role="status">{state.message}</p>;
  return null;
}

export function CreateDependentForm({ defaultName, defaultBirthDate }: { defaultName: string; defaultBirthDate: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createDependent, {});
  const [key] = useState(() => crypto.randomUUID());
  return (
    <form action={action}>
      <input type="hidden" name="idempotencyKey" value={key} />
      <label>Nome do menor <input name="displayName" minLength={2} maxLength={120} defaultValue={defaultName} required /></label>
      <label>Data de nascimento do menor <input name="birthDate" type="date" min="1900-01-01" defaultValue={defaultBirthDate} required /></label>
      <label>Seu parentesco (ex.: mãe, pai, avó, tutor) <input name="relationship" minLength={2} maxLength={40} required /></label>
      <p><small>Você será o responsável legal e é quem usa o app em nome do menor. O menor não tem login próprio.</small></p>
      <button type="submit" disabled={pending}>{pending ? "Cadastrando…" : "Cadastrar menor"}</button>
      <Status state={state} />
    </form>
  );
}

export function RequestForDependentForm({ minorId, academyId }: { minorId: string; academyId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestForDependent.bind(null, minorId, academyId), {});
  return (
    <form action={action}>
      <p>
        <small>
          Termo de consentimento (<strong>rascunho, em revisão jurídica</strong>): autorizo o menor a participar das aulas e que a academia
          trate os dados de frequência e graduação dele para essa finalidade. Posso revogar a qualquer momento, e o menor será suspenso.
        </small>
      </p>
      <label><input type="checkbox" name="consent" required /> Li e concordo com o termo de consentimento</label>
      <label><input type="checkbox" name="photos" /> Autorizo também o uso de fotos do menor (opcional; desligado por padrão)</label>
      <button type="submit" disabled={pending}>{pending ? "Enviando…" : "Pedir vaga para o menor"}</button>
      <Status state={state} />
    </form>
  );
}

export function InviteForm({ minorId }: { minorId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createInvite.bind(null, minorId), {});
  return (
    <form action={action}>
      <button type="submit" disabled={pending}>{pending ? "Gerando…" : "Gerar código para outro responsável financeiro"}</button>
      <Status state={state} />
    </form>
  );
}

export function AcceptInviteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInvite, {});
  return (
    <form action={action}>
      <label>Código recebido <input name="code" minLength={10} maxLength={20} autoComplete="off" required /></label>
      <label>Seu parentesco com o menor <input name="relationship" minLength={2} maxLength={40} required /></label>
      <button type="submit" disabled={pending}>{pending ? "Verificando…" : "Tornar-me responsável financeiro"}</button>
      <Status state={state} />
    </form>
  );
}
