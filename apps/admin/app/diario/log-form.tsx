"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { saveLog, searchTechniqueOptions, type TechniqueOption } from "./actions";
import type { FormState } from "../login/actions";

type Props = {
  logId?: string;
  academies: { id: string; name: string }[];
  initial: { academyId: string; trainedDate: string; notes: string; techniques: TechniqueOption[] };
};

export function LogForm({ logId, academies, initial }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLog, {});
  // One key per form instance: tapping "Salvar" twice never creates two entries.
  const [clientKey] = useState(() => crypto.randomUUID());
  const [selected, setSelected] = useState<TechniqueOption[]>(initial.techniques);
  const [results, setResults] = useState<TechniqueOption[]>([]);
  const [query, setQuery] = useState("");
  const [searching, startSearch] = useTransition();
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function onQuery(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startSearch(async () => {
        setResults(await searchTechniqueOptions(value));
        setSearched(true);
      });
    }, 250);
  }

  const chosen = new Set(selected.map((t) => t.id));

  return (
    <form action={action}>
      {logId && <input type="hidden" name="logId" value={logId} />}
      <input type="hidden" name="clientKey" value={clientKey} />
      {selected.map((t) => <input key={t.id} type="hidden" name="techniqueId" value={t.id} />)}

      <label>Data do treino <input name="trainedDate" type="date" defaultValue={initial.trainedDate} required /></label>
      <label>
        Onde treinou{" "}
        <select name="academyId" defaultValue={initial.academyId}>
          <option value="">Treino pessoal / fora de academia</option>
          {academies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>

      <fieldset>
        <legend>Técnicas treinadas ({selected.length})</legend>
        {selected.length === 0 ? <p>Nenhuma técnica escolhida.</p> : (
          <ul>
            {selected.map((t) => (
              <li key={t.id}>
                {t.name} — {t.category}{" "}
                <button type="button" onClick={() => setSelected(selected.filter((s) => s.id !== t.id))}>Remover</button>
              </li>
            ))}
          </ul>
        )}
        <label>Buscar no catálogo <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="nome ou sinônimo" /></label>
        {searching && <p role="status">Buscando…</p>}
        {searched && !searching && results.length === 0 && <p>Nenhuma técnica encontrada.</p>}
        <ul>
          {results.filter((t) => !chosen.has(t.id)).map((t) => (
            <li key={t.id}>
              {t.name} — {t.category}{" "}
              <button type="button" onClick={() => setSelected([...selected, t])}>Adicionar</button>
            </li>
          ))}
        </ul>
      </fieldset>

      <label>Anotações (privadas) <textarea name="notes" defaultValue={initial.notes} maxLength={10000} rows={6} /></label>
      <p><small>Seu diário é privado. Registrar um treino aqui não conta como presença na academia.</small></p>
      <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
