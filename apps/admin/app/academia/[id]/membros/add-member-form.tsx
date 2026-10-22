"use client";

import { useActionState } from "react";
import { addMember } from "./actions";
import type { FormState } from "../../../login/actions";
import { PreservingForm } from "@/components/ui/PreservingForm";

export function AddMemberForm({ academyId }: { academyId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => addMember(academyId, prev, formData), {});
  return (
    <PreservingForm action={action} state={state} resetOnSuccess>
      <label>E-mail (a pessoa precisa ter conta) <input name="email" type="email" required /></label>
      <label>
        Papel{" "}
        <select name="role" defaultValue="student">
          <option value="student">Aluno</option>
          <option value="instructor">Instrutor (colaborador)</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>{pending ? "Cadastrando…" : "Cadastrar"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </PreservingForm>
  );
}
