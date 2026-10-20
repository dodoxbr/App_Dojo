"use client";

import { useActionState, useState } from "react";
import { assessManual, correctPromotion, grantPromotion, registerRank } from "./actions";
import type { FormState } from "../../../login/actions";

export function RegisterRankForm({ academyId, userId }: { academyId: string; userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerRank.bind(null, academyId, userId), {});
  const [key] = useState(() => crypto.randomUUID());
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="idempotencyKey" value={key} />
      <input name="beltCode" placeholder="faixa" maxLength={40} required aria-label="Faixa" />{" "}
      <input name="degree" type="number" min={0} max={20} defaultValue={0} required aria-label="Grau" style={{ width: 60 }} />{" "}
      <input name="effectiveDate" type="date" defaultValue={today} max={today} required aria-label="Data da última graduação" />{" "}
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Registrar graduação atual"}</button>
      {state.error && <span role="alert"> {state.error}</span>}
      {state.message && <span role="status"> {state.message}</span>}
    </form>
  );
}

export function ManualCriterionForm({ academyId, userId, label }: { academyId: string; userId: string; label: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(assessManual.bind(null, academyId, userId, label), {});
  // New key whenever a field changes: a double click repeats the same request, a different choice is a new one.
  const [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <form action={action} onChange={() => setKey(crypto.randomUUID())} style={{ display: "inline" }}>
      <input type="hidden" name="idempotencyKey" value={key} />
      <select name="met" defaultValue="true" aria-label={`Avaliação: ${label}`}>
        <option value="true">Atende</option>
        <option value="false">Não atende</option>
      </select>{" "}
      <input name="note" placeholder="observação" maxLength={500} />{" "}
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
      {state.error && <span role="alert"> {state.error}</span>}
      {state.message && <span role="status"> {state.message}</span>}
    </form>
  );
}

type Rank = { beltCode: string; degree: number; effectiveDate: string };

export function GrantPromotionForm({ academyId, userId, current }: { academyId: string; userId: string; current: Rank }) {
  const [state, action, pending] = useActionState<FormState, FormData>(grantPromotion.bind(null, academyId, userId), {});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} onChange={() => setKey(crypto.randomUUID())}>
      <input type="hidden" name="idempotencyKey" value={key} />
      <label>Nova faixa <input name="beltCode" defaultValue={current.beltCode} maxLength={40} required /></label>
      <label>Novo grau <input name="degree" type="number" min={0} max={20} defaultValue={current.degree + 1} required /></label>
      <label>Vale desde <input name="effectiveDate" type="date" defaultValue={today} min={current.effectiveDate} max={today} required /></label>
      <label>Justificativa <input name="reason" minLength={3} maxLength={500} required placeholder="por que esta graduação foi concedida" /></label>
      <button type="submit" disabled={pending}>{pending ? "Concedendo…" : "Conceder graduação"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}

export function CorrectPromotionForm({ academyId, promotionId, current }: { academyId: string; promotionId: string; current: Rank }) {
  const [state, action, pending] = useActionState<FormState, FormData>(correctPromotion.bind(null, academyId, promotionId), {});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} onChange={() => setKey(crypto.randomUUID())}>
      <input type="hidden" name="idempotencyKey" value={key} />
      <label>Faixa correta <input name="beltCode" defaultValue={current.beltCode} maxLength={40} required /></label>
      <label>Grau correto <input name="degree" type="number" min={0} max={20} defaultValue={current.degree} required /></label>
      <label>Data correta <input name="effectiveDate" type="date" defaultValue={current.effectiveDate} max={today} required /></label>
      <label>Motivo da retificação <input name="reason" minLength={3} maxLength={500} required /></label>
      <button type="submit" disabled={pending}>{pending ? "Retificando…" : "Retificar registro"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
