"use client";

import { useActionState } from "react";
import { requestMembership } from "./actions";
import type { FormState } from "../../login/actions";
import { PreservingForm } from "@/components/ui/PreservingForm";

export function RequestButton({ academyId }: { academyId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(() => requestMembership(academyId), {});
  return (
    <PreservingForm action={action} state={state}>
      <button type="submit" disabled={pending}>{pending ? "Enviando…" : "Solicitar entrada"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </PreservingForm>
  );
}
