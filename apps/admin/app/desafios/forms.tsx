"use client";

import { useActionState, useState } from "react";
import { challengeMetricLabels, challengeMetrics, type ChallengeMetric } from "@dojo/contracts/challenges";
import { addEntry, createChallenge } from "./actions";
import type { FormState } from "../login/actions";

type Option = { id: string; label: string };

export function CreateChallengeForm({ academies, techniques }: { academies: Option[]; techniques: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createChallenge, {});
  const [key] = useState(() => crypto.randomUUID());
  const [metric, setMetric] = useState<ChallengeMetric>("training");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action}>
      <input type="hidden" name="idempotencyKey" value={key} />
      {academies.length > 1 ? (
        <label>
          Academia{" "}
          <select name="academyId" required defaultValue={academies[0]?.id}>
            {academies.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
      ) : (
        <input type="hidden" name="academyId" value={academies[0]?.id ?? ""} />
      )}
      <label>Nome do desafio <input name="title" minLength={2} maxLength={120} required placeholder="ex.: Maratona de treinos" /></label>
      <label>Descrição (opcional) <textarea name="description" maxLength={1000} rows={3} /></label>
      <label>
        O que vale ponto{" "}
        <select name="metric" value={metric} onChange={(e) => setMetric(e.target.value as ChallengeMetric)}>
          {challengeMetrics.map((m) => <option key={m} value={m}>{challengeMetricLabels[m]}</option>)}
        </select>
      </label>
      {metric === "technique_reps" && (
        <label>
          Técnica{" "}
          <select name="techniqueId" required defaultValue="">
            <option value="" disabled>Escolha…</option>
            {techniques.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      )}
      <label>
        Pontos por {metric === "attendance" ? "presença validada" : metric === "training" ? "treino" : "repetição"}{" "}
        <input name="pointsPerUnit" type="number" min={1} max={1000} required />
      </label>
      {metric !== "attendance" && (
        <label>
          Limite por dia, por pessoa (opcional){" "}
          <input name="maxUnitsPerDay" type="number" min={1} max={10000} placeholder={metric === "training" ? "ex.: 1 treino por dia" : "ex.: 100"} />
        </label>
      )}
      <label>Começa em <input name="startsOn" type="date" min={today} defaultValue={today} required /></label>
      <label>Termina em <input name="endsOn" type="date" min={today} required /></label>
      <label>
        Mínimo de participantes para ativar (3 a 50){" "}
        <input name="minParticipants" type="number" min={3} max={50} defaultValue={5} required />
      </label>
      <p><small>Quando o mínimo for atingido, o desafio ativa sozinho e já começa. Só maiores de 18 anos participam.</small></p>
      <label><input type="checkbox" name="join" defaultChecked /> Participar também</label>
      <button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar desafio"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}

export function EntryForm({ challengeId, metric, today }: { challengeId: string; metric: ChallengeMetric; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => addEntry(challengeId, prev, formData), {});
  // The key changes with the data: a double click repeats the same request, another day/time is a new one.
  const [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <form action={action} onChange={() => setKey(crypto.randomUUID())}>
      <input type="hidden" name="clientKey" value={key} />
      <label>Dia em que treinou <input name="date" type="date" max={today} defaultValue={today} required /></label>
      <label>Hora <input name="time" type="time" required /></label>
      {metric === "technique_reps" && (
        <label>Repetições <input name="units" type="number" min={1} max={10000} required /></label>
      )}
      <label>Observação (opcional) <input name="note" maxLength={200} /></label>
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Registrar"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
