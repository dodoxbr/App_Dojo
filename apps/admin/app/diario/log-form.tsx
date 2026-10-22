"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import { PreservingForm } from "@/components/ui/PreservingForm";
import { saveLog, searchTechniqueOptions, type TechniqueOption } from "./actions";
import type { FormState } from "../login/actions";
import styles from "./log-form.module.css";

type Props = {
  logId?: string;
  academies: { id: string; name: string }[];
  initial: { academyId: string; trainedDate: string; startTime: string; endTime: string; notes: string; techniques: TechniqueOption[] };
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
    <PreservingForm action={action} state={state} className={styles.form}>
      {logId && <input type="hidden" name="logId" value={logId} />}
      <input type="hidden" name="clientKey" value={clientKey} />
      {selected.map((t) => <input key={t.id} type="hidden" name="techniqueId" value={t.id} />)}

      <div className={styles.when}>
        <label>Data do treino <input name="trainedDate" type="date" defaultValue={initial.trainedDate} required /></label>
        <label>Início <input name="startTime" type="time" defaultValue={initial.startTime} required /></label>
        <label>Término (opcional) <input name="endTime" type="time" defaultValue={initial.endTime} /></label>
      </div>
      <p className={styles.hint}>Informe o horário em que você treinou, por exemplo das 07:00 às 08:30.</p>

      <label>
        Onde treinou
        <select name="academyId" defaultValue={initial.academyId}>
          <option value="">Treino pessoal / fora de academia</option>
          {academies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>

      <fieldset className={styles.techniques}>
        <legend>Técnicas treinadas ({selected.length})</legend>
        {selected.length === 0 ? <p className={styles.hint}>Nenhuma técnica escolhida.</p> : (
          <ul className={styles.chosen}>
            {selected.map((t) => (
              <li key={t.id}>
                <span><strong>{t.name}</strong> <Badge tone="accent">{t.category}</Badge></span>
                <Button type="button" variant="secondary" onClick={() => setSelected(selected.filter((s) => s.id !== t.id))}>Remover</Button>
              </li>
            ))}
          </ul>
        )}
        <label>Buscar no catálogo <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="nome ou sinônimo" /></label>
        {searching && <p className={styles.hint} role="status">Buscando…</p>}
        {searched && !searching && results.length === 0 && <p className={styles.hint}>Nenhuma técnica encontrada.</p>}
        <ul className={styles.chosen}>
          {results.filter((t) => !chosen.has(t.id)).map((t) => (
            <li key={t.id}>
              <span><strong>{t.name}</strong> <Badge tone="neutral">{t.category}</Badge></span>
              <Button type="button" variant="secondary" onClick={() => setSelected([...selected, t])}>Adicionar</Button>
            </li>
          ))}
        </ul>
      </fieldset>

      <label>Anotações (privadas) <textarea name="notes" defaultValue={initial.notes} maxLength={10000} rows={6} /></label>
      <p className={styles.hint}>Seu diário é privado. Registrar um treino aqui não conta como presença na academia.</p>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
      </div>
    </PreservingForm>
  );
}
