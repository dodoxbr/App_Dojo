"use client";

import { useActionState, useState } from "react";
import { formatClock, parseTimes, weekdayShort, type ScheduleGroup } from "@dojo/contracts/academy-page";
import { Alert, Button } from "@/components/ui";
import type { FormState } from "../../../login/actions";
import { saveAcademySchedule } from "./schedule-actions";
import styles from "./pagina.module.css";

type Line = { days: number[]; times: string; label: string };
type Group = { title: string; note: string; lines: Line[] };

const blankLine = (): Line => ({ days: [], times: "", label: "" });
const blankGroup = (): Group => ({ title: "", note: "", lines: [blankLine()] });

function fromSaved(schedule: ScheduleGroup[]): Group[] {
  return schedule.map((g) => ({
    title: g.title,
    note: g.note ?? "",
    lines: g.lines.map((l) => ({ days: l.days, times: l.times.map(formatClock).join(", "), label: l.label ?? "" })),
  }));
}

// Editor da grade de horários: grupos (ex.: Adulto, Infantil, Feminino) com linhas de dias e horários. O envio leva tudo num campo JSON.
export function ScheduleForm({ academyId, saved }: { academyId: string; saved: ScheduleGroup[] }) {
  const [groups, setGroups] = useState<Group[]>(() => (saved.length ? fromSaved(saved) : [blankGroup()]));
  const [localError, setLocalError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => saveAcademySchedule(academyId, prev, formData), {});

  const patchGroup = (gi: number, patch: Partial<Group>) => setGroups(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const patchLine = (gi: number, li: number, patch: Partial<Line>) =>
    patchGroup(gi, { lines: groups[gi]!.lines.map((l, i) => (i === li ? { ...l, ...patch } : l)) });
  const toggleDay = (gi: number, li: number, day: number) => {
    const l = groups[gi]!.lines[li]!;
    patchLine(gi, li, { days: l.days.includes(day) ? l.days.filter((d) => d !== day) : [...l.days, day].sort((a, b) => a - b) });
  };

  function payload(): string | null {
    const out: unknown[] = [];
    for (const g of groups) {
      const empty = !g.title.trim() && g.lines.every((l) => l.days.length === 0 && !l.times.trim());
      if (empty) continue; // grupo em branco é ignorado
      const lines = [];
      for (const l of g.lines) {
        if (l.days.length === 0 && !l.times.trim()) continue;
        const times = parseTimes(l.times);
        if (!times || times.length === 0) {
          setLocalError(`Horário inválido em "${g.title || "grupo sem nome"}". Use algo como 07:00, 9h ou 20h30.`);
          return null;
        }
        lines.push({ days: l.days, times, label: l.label });
      }
      out.push({ title: g.title, note: g.note, lines });
    }
    setLocalError(null);
    return JSON.stringify(out);
  }

  return (
    <form
      className={styles.form}
      action={(formData) => {
        const json = payload();
        if (json === null) return;
        formData.set("schedule", json);
        action(formData);
      }}
    >
      {groups.map((g, gi) => (
        <fieldset key={gi} className={styles.group}>
          <legend>Grupo {gi + 1}</legend>
          <div className={styles.two}>
            <label>Nome do grupo <input value={g.title} maxLength={60} onChange={(e) => patchGroup(gi, { title: e.target.value })} placeholder="Ex.: Adulto — Manhã, Infantil, Feminino" /></label>
            <label>Observação (opcional) <input value={g.note} maxLength={120} onChange={(e) => patchGroup(gi, { note: e.target.value })} placeholder="Ex.: Turma Kids, sem kimono…" /></label>
          </div>
          {g.lines.map((l, li) => (
            <div key={li} className={styles.line}>
              <div className={styles.days} role="group" aria-label="Dias da semana">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <label key={d} className={`${styles.day} ${l.days.includes(d) ? styles.dayOn : ""}`}>
                    <input type="checkbox" checked={l.days.includes(d)} onChange={() => toggleDay(gi, li, d)} />
                    {weekdayShort[d]}
                  </label>
                ))}
              </div>
              <label>Horários <input value={l.times} onChange={(e) => patchLine(gi, li, { times: e.target.value })} placeholder="07:00, 9h e 12h" /></label>
              <label>Rótulo (opcional) <input value={l.label} maxLength={40} onChange={(e) => patchLine(gi, li, { label: e.target.value })} placeholder="Ex.: Sem kimono" /></label>
              {g.lines.length > 1 && (
                <Button type="button" variant="secondary" onClick={() => patchGroup(gi, { lines: g.lines.filter((_, i) => i !== li) })}>Remover linha</Button>
              )}
            </div>
          ))}
          <div className={styles.rowActions}>
            {g.lines.length < 8 && <Button type="button" variant="secondary" onClick={() => patchGroup(gi, { lines: [...g.lines, blankLine()] })}>+ Linha de horário</Button>}
            <Button type="button" variant="secondary" onClick={() => setGroups(groups.filter((_, i) => i !== gi))}>Remover o grupo</Button>
          </div>
        </fieldset>
      ))}
      <div className={styles.rowActions}>
        {groups.length < 12 && <Button type="button" variant="secondary" onClick={() => setGroups([...groups, blankGroup()])}>+ Novo grupo de horários</Button>}
      </div>
      {localError && <Alert tone="danger">{localError}</Alert>}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <div><Button type="submit" loading={pending}>{pending ? "Salvando…" : "Salvar a grade de horários"}</Button></div>
    </form>
  );
}
