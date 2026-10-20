"use client";

import { useActionState, useState } from "react";
import { beltSuggestions } from "@dojo/contracts/belts";
import { criterionKindLabels, criterionKinds, type CriterionKind } from "@dojo/contracts/graduation";
import { createRule } from "./actions";
import type { FormState } from "../../../login/actions";

type Row = {
  kind: CriterionKind;
  label: string;
  minDays: string;
  minAttendances: string;
  windowDays: string;
  distinctDays: boolean;
  curriculumId: string;
  minPercent: string;
};

export type InitialCriterion = Partial<Omit<Row, "kind" | "label">> & { kind: CriterionKind; label: string };

const blank = (kind: CriterionKind = "min_days"): Row => ({
  kind, label: "", minDays: "", minAttendances: "", windowDays: "", distinctDays: false, curriculumId: "", minPercent: "",
});

// Turns the editable rows into the objects the server validates (numbers, only the fields of each kind).
function toPayload(rows: Row[]) {
  return rows.map((r) => {
    const n = (v: string) => (v.trim() === "" ? undefined : Number(v));
    switch (r.kind) {
      case "min_days": return { kind: r.kind, label: r.label, minDays: n(r.minDays) };
      case "attendance": return { kind: r.kind, label: r.label, minAttendances: n(r.minAttendances), windowDays: n(r.windowDays), distinctDays: r.distinctDays };
      case "curriculum": return { kind: r.kind, label: r.label, curriculumId: r.curriculumId, minPercent: n(r.minPercent) };
      default: return { kind: r.kind, label: r.label };
    }
  });
}

type Props = {
  academyId: string;
  curricula: { id: string; title: string }[];
  initial?: { beltCode: string; degree: number; title: string; criteria: InitialCriterion[] };
};

export function RuleBuilder({ academyId, curricula, initial }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(createRule.bind(null, academyId), {});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [rows, setRows] = useState<Row[]>(
    initial?.criteria.length ? initial.criteria.map((c) => ({ ...blank(c.kind), ...c })) : [blank()],
  );
  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} onChange={() => setKey(crypto.randomUUID())}>
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="criteria" value={JSON.stringify(toPayload(rows))} />

      <label>Faixa de partida <input name="beltCode" list="belt-suggestions" defaultValue={initial?.beltCode} maxLength={40} required placeholder="como a academia chama" /></label>
      <datalist id="belt-suggestions">{beltSuggestions.map((b) => <option key={b} value={b} />)}</datalist>
      <label>Grau de partida <input name="degree" type="number" min={0} max={20} defaultValue={initial?.degree ?? 0} required /></label>
      <label>Nome da regra (opcional) <input name="title" defaultValue={initial?.title} maxLength={120} /></label>
      <label>Vale a partir de <input name="effectiveFrom" type="date" defaultValue={today} required /></label>

      <fieldset>
        <legend>Critérios (todos precisam ser atendidos)</legend>
        {rows.map((r, i) => (
          <div key={i} style={{ border: "1px solid #999", padding: 8, margin: "8px 0" }}>
            <label>
              Tipo{" "}
              <select value={r.kind} onChange={(e) => update(i, { ...blank(e.target.value as CriterionKind), label: r.label })}>
                {criterionKinds.map((k) => <option key={k} value={k}>{criterionKindLabels[k]}</option>)}
              </select>
            </label>
            <label>Nome do critério <input value={r.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={120} required placeholder="ex.: Comprometimento" /></label>
            {r.kind === "min_days" && (
              <label>Mínimo de dias <input type="number" min={1} max={3650} value={r.minDays} onChange={(e) => update(i, { minDays: e.target.value })} required /></label>
            )}
            {r.kind === "attendance" && (
              <>
                <label>Mínimo de presenças validadas <input type="number" min={1} max={5000} value={r.minAttendances} onChange={(e) => update(i, { minAttendances: e.target.value })} required /></label>
                <label>Só nos últimos (dias, opcional) <input type="number" min={1} max={3650} value={r.windowDays} onChange={(e) => update(i, { windowDays: e.target.value })} /></label>
                <label><input type="checkbox" checked={r.distinctDays} onChange={(e) => update(i, { distinctDays: e.target.checked })} /> Contar dias diferentes (duas aulas no mesmo dia valem uma)</label>
              </>
            )}
            {r.kind === "curriculum" && (
              <>
                <label>
                  Currículo{" "}
                  <select value={r.curriculumId} onChange={(e) => update(i, { curriculumId: e.target.value })} required>
                    <option value="" disabled>Escolha…</option>
                    {curricula.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>
                <label>% mínimo das técnicas obrigatórias validadas <input type="number" min={1} max={100} value={r.minPercent} onChange={(e) => update(i, { minPercent: e.target.value })} required /></label>
              </>
            )}
            {r.kind === "manual" && <p><small>O professor ou o gestor marca “atende” ou “não atende” para cada aluno, depois da última graduação.</small></p>}
            {rows.length > 1 && <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remover critério</button>}
          </div>
        ))}
        {rows.length < 20 && <button type="button" onClick={() => setRows([...rows, blank()])}>Adicionar critério</button>}
      </fieldset>

      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar regra (nova versão)"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
